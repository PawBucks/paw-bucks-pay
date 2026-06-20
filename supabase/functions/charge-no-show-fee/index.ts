import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveUserEarnTier } from "../_shared/resolve-tier.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { bookingId, reason } = await req.json();
    if (!bookingId) {
      return new Response(JSON.stringify({ error: "Missing bookingId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Verify merchant ownership and get booking details
    const { data: booking, error: bookingError } = await adminClient
      .from("service_bookings")
      .select("*, merchant_services(name, no_show_fee_amount)")
      .eq("id", bookingId)
      .single();

    if (bookingError || !booking) {
      return new Response(JSON.stringify({ error: "Booking not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify the current user owns this merchant
    const { data: merchant } = await adminClient
      .from("merchants")
      .select("id, stripe_account_id, business_name")
      .eq("id", booking.merchant_id)
      .eq("user_id", user.id)
      .single();

    if (!merchant) {
      return new Response(JSON.stringify({ error: "Not authorized" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!booking.stripe_payment_method_id) {
      return new Response(JSON.stringify({ error: "No payment method on file for this booking" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if already charged
    const { data: existingCharge } = await adminClient
      .from("no_show_charges")
      .select("id")
      .eq("booking_id", bookingId)
      .eq("status", "succeeded")
      .maybeSingle();

    if (existingCharge) {
      return new Response(JSON.stringify({ error: "No-show fee already charged for this booking" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const feeAmount = booking.merchant_services?.no_show_fee_amount || booking.deposit_amount || 0;
    if (feeAmount <= 0) {
      return new Response(JSON.stringify({ error: "No fee amount configured" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Find the customer on the connected account from the payment method
    const paymentMethod = await stripe.paymentMethods.retrieve(
      booking.stripe_payment_method_id,
      { stripeAccount: merchant.stripe_account_id }
    );

    // Create PaymentIntent (Direct Charge) on connected account
    const amountCents = Math.round(feeAmount * 100);
    const applicationFee = Math.round(amountCents * 0.03); // 3% platform fee

    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: amountCents,
        currency: "usd",
        customer: paymentMethod.customer as string,
        payment_method: booking.stripe_payment_method_id,
        off_session: true,
        confirm: true,
        application_fee_amount: applicationFee,
        description: `No-show fee for ${booking.merchant_services?.name || "booking"} on ${booking.booking_date}`,
        metadata: {
          booking_id: bookingId,
          merchant_id: booking.merchant_id,
          user_id: booking.user_id,
          type: "no_show_fee",
        },
      },
      { stripeAccount: merchant.stripe_account_id }
    );

    // Record the charge
    await adminClient.from("no_show_charges").insert({
      booking_id: bookingId,
      merchant_id: booking.merchant_id,
      user_id: booking.user_id,
      amount: feeAmount,
      stripe_payment_intent_id: paymentIntent.id,
      status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
      charged_by: user.id,
      reason: reason || "Client did not show up for appointment",
    });

    // Update booking deposit status
    await adminClient
      .from("service_bookings")
      .update({ deposit_status: "charged_no_show" })
      .eq("id", bookingId);

    // Award PawBucks to the customer on the USD no-show charge (tier-based).
    // Idempotent on the payment intent id via pawbucks_activity uniqueness check.
    let pawbucksEarned = 0;
    if (paymentIntent.status === "succeeded" && booking.user_id) {
      try {
        const { data: existingEarn } = await adminClient
          .from("pawbucks_activity")
          .select("id")
          .eq("user_id", booking.user_id)
          .eq("source", "no_show_fee")
          .eq("description", `no_show_pi:${paymentIntent.id}`)
          .maybeSingle();

        if (!existingEarn) {
          // Determine tier multiplier via shared resolver (resilient to new
          // Stripe product IDs — recognizes PawPass / PawPass+ by name).
          const { data: platformSub } = await adminClient
            .from("subscriptions")
            .select("stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status")
            .eq("user_id", booking.user_id)
            .in("status", ["active", "trialing"])
            .maybeSingle();
          const resolvedTier = await resolveUserEarnTier(stripe, platformSub);
          const multiplier = resolvedTier.multiplier;
          const tierName = resolvedTier.label;

          pawbucksEarned = Math.floor(feeAmount * multiplier);

          if (pawbucksEarned > 0) {
            await adminClient.from("pawbucks_activity").insert({
              user_id: booking.user_id,
              amount: pawbucksEarned,
              type: "earn",
              source: "no_show_fee",
              description: `no_show_pi:${paymentIntent.id}`,
              pawbucks_status: "available",
              partner_id: booking.merchant_id,
            });

            const { data: wallet } = await adminClient
              .from("pawbucks_wallet")
              .select("balance")
              .eq("user_id", booking.user_id)
              .maybeSingle();
            if (wallet) {
              await adminClient
                .from("pawbucks_wallet")
                .update({ balance: (wallet.balance || 0) + pawbucksEarned })
                .eq("user_id", booking.user_id);
            } else {
              await adminClient
                .from("pawbucks_wallet")
                .insert({ user_id: booking.user_id, balance: pawbucksEarned });
            }
            console.log(`Awarded ${pawbucksEarned} PB (${tierName} ${multiplier}x) on $${feeAmount} no-show fee`);
          }
        }
      } catch (earnErr) {
        console.error("Failed to award PB on no-show fee:", earnErr);
        // Non-fatal: charge succeeded, earn can be reconciled manually
      }
    }

    // Notify the customer
    await adminClient.from("notifications").insert({
      user_id: booking.user_id,
      title: "💳 No-Show Fee Charged",
      message: `A $${feeAmount.toFixed(2)} no-show fee was charged for your missed ${booking.merchant_services?.name || "appointment"} on ${booking.booking_date}.${pawbucksEarned > 0 ? ` You earned ${pawbucksEarned.toLocaleString()} PawBucks back.` : ""} Contact ${merchant.business_name} if you believe this is an error.`,
      category: "transactional",
    });

    return new Response(
      JSON.stringify({
        success: true,
        chargeAmount: feeAmount,
        paymentIntentId: paymentIntent.id,
        status: paymentIntent.status,
        pawbucksEarned,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error charging no-show fee:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
