import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

// Grace window after end_time before flagging as no-show (minutes).
// This protects against late check-ins / merchants who haven't marked completion yet.
const GRACE_MINUTES = 60;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }
  const _authResp = checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;
);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
  );

  const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
    apiVersion: "2024-12-18.acacia",
  });

  const summary = { scanned: 0, flagged: 0, charged: 0, skipped: 0, errors: 0 };

  try {
    const nowUtc = new Date();
    const cutoff = new Date(nowUtc.getTime() - GRACE_MINUTES * 60 * 1000);
    // Use a wide date filter (today and yesterday EST) — final filter happens via timestamp combine.
    const todayISO = nowUtc.toISOString().slice(0, 10);
    const yesterday = new Date(nowUtc.getTime() - 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10);

    const { data: candidates, error: queryError } = await admin
      .from("service_bookings")
      .select(
        "id, merchant_id, user_id, booking_date, end_time, stripe_payment_method_id, deposit_status, deposit_amount, customer_name, merchant_services(name, no_show_fee_amount)"
      )
      .eq("status", "confirmed")
      .in("booking_date", [yesterday, todayISO])
      .not("stripe_payment_method_id", "is", null);

    if (queryError) throw queryError;

    for (const booking of candidates ?? []) {
      summary.scanned++;
      try {
        // Combine booking_date + end_time as UTC-naive — treat as wall-clock.
        // We can't perfectly resolve merchant TZ here, so use a conservative
        // grace window plus the assumption stored times reflect appointment local time.
        const endDt = new Date(`${booking.booking_date}T${booking.end_time}Z`);
        if (isNaN(endDt.getTime()) || endDt > cutoff) {
          summary.skipped++;
          continue;
        }

        // Skip if already charged / already flagged
        const { data: existingCharge } = await admin
          .from("no_show_charges")
          .select("id, status")
          .eq("booking_id", booking.id)
          .maybeSingle();
        if (existingCharge) {
          summary.skipped++;
          continue;
        }

        // 1. Mark booking as no_show
        await admin
          .from("service_bookings")
          .update({ status: "no_show" })
          .eq("id", booking.id);
        summary.flagged++;

        const feeAmount =
          Number((booking as any).merchant_services?.no_show_fee_amount) ||
          Number(booking.deposit_amount) ||
          0;

        if (feeAmount <= 0 || !booking.stripe_payment_method_id) {
          // Notify merchant only — nothing to charge
          await admin.from("notifications").insert({
            user_id: null, // broadcast to merchant via merchant lookup below if desired
            title: "No-show detected",
            message: `Booking on ${booking.booking_date} for ${
              booking.customer_name || "a customer"
            } was auto-flagged as no-show. No fee was on file to charge.`,
            category: "transactional",
          });
          continue;
        }

        // 2. Resolve merchant Stripe Connect
        const { data: merchant } = await admin
          .from("merchants")
          .select("id, user_id, stripe_account_id, business_name")
          .eq("id", booking.merchant_id)
          .single();

        if (!merchant?.stripe_account_id) {
          summary.skipped++;
          continue;
        }

        // 3. Charge via direct charge on connected account
        const paymentMethod = await stripe.paymentMethods.retrieve(
          booking.stripe_payment_method_id,
          { stripeAccount: merchant.stripe_account_id }
        );

        const amountCents = Math.round(feeAmount * 100);
        const applicationFee = Math.round(amountCents * 0.03);

        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: amountCents,
            currency: "usd",
            customer: paymentMethod.customer as string,
            payment_method: booking.stripe_payment_method_id,
            off_session: true,
            confirm: true,
            application_fee_amount: applicationFee,
            description: `Auto no-show fee for ${
              (booking as any).merchant_services?.name || "booking"
            } on ${booking.booking_date}`,
            metadata: {
              booking_id: booking.id,
              merchant_id: booking.merchant_id,
              user_id: booking.user_id,
              type: "auto_no_show_fee",
            },
          },
          { stripeAccount: merchant.stripe_account_id }
        );

        await admin.from("no_show_charges").insert({
          booking_id: booking.id,
          merchant_id: booking.merchant_id,
          user_id: booking.user_id,
          amount: feeAmount,
          stripe_payment_intent_id: paymentIntent.id,
          status: paymentIntent.status === "succeeded" ? "succeeded" : "pending",
          charged_by: null,
          reason: "Auto-detected no-show (system)",
        });

        await admin
          .from("service_bookings")
          .update({ deposit_status: "charged_no_show" })
          .eq("id", booking.id);

        // Notify customer
        if (booking.user_id) {
          await admin.from("notifications").insert({
            user_id: booking.user_id,
            title: "💳 No-Show Fee Charged",
            message: `A $${feeAmount.toFixed(2)} no-show fee was charged for your missed ${
              (booking as any).merchant_services?.name || "appointment"
            } on ${booking.booking_date}. Contact ${
              merchant.business_name
            } if you believe this is an error.`,
            category: "transactional",
          });
        }

        // Notify merchant owner
        if (merchant.user_id) {
          await admin.from("notifications").insert({
            user_id: merchant.user_id,
            title: "Auto no-show fee collected",
            message: `$${feeAmount.toFixed(2)} no-show fee was automatically collected for ${
              booking.customer_name || "a customer"
            }'s missed appointment on ${booking.booking_date}.`,
            category: "transactional",
          });
        }

        summary.charged++;
      } catch (innerErr) {
        console.error("auto-detect-no-shows: booking failed", booking.id, innerErr);
        summary.errors++;
      }
    }

    return new Response(JSON.stringify({ success: true, summary }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("auto-detect-no-shows fatal error", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
        summary,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});