import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONNECT-WEBHOOK] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  try {
    logStep("Webhook received");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    const body = await req.text();
    
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      logStep("Webhook signature verification failed", { error: String(err) });
      return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
    }

    logStep("Event received", { type: event.type, id: event.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Handle events from connected accounts
    const connectedAccountId = event.account;
    if (connectedAccountId) {
      logStep("Event from connected account", { accountId: connectedAccountId });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment succeeded", { 
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata 
        });

        const metadata = paymentIntent.metadata || {};
        const userId = metadata.user_id;
        const merchantId = metadata.merchant_id;
        const pawbucksEarned = parseInt(metadata.pawbucks_earned || "0", 10);

        // Update direct_payments status
        const { error: updateError } = await supabaseAdmin
          .from("direct_payments")
          .update({ status: "succeeded" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("Error updating payment status", { error: updateError.message });
        }

        // Award PawBucks to user
        if (userId && pawbucksEarned > 0) {
          logStep("Awarding PawBucks", { userId, pawbucksEarned });

          // Log activity
          await supabaseAdmin
            .from("pawbucks_activity")
            .insert({
              user_id: userId,
              amount: pawbucksEarned,
              type: "credit",
              source: "direct_payment",
              description: `Earned from payment to ${metadata.business_name || "merchant"}`,
              pawbucks_status: "available",
            });

          logStep("PawBucks credited to user");
        }

        // Create transaction record with accurate fee tracking
        if (userId && merchantId) {
          const amountInDollars = paymentIntent.amount / 100;
          // Platform fee (3%) only on Stripe portion
          const platformFee = amountInDollars * 0.03;
          
          await supabaseAdmin
            .from("transactions")
            .insert({
              user_id: userId,
              merchant_id: merchantId,
              amount: amountInDollars,
              stripe_amount: amountInDollars, // Full amount via Stripe for direct payments
              pawbucks_used: 0, // No PawBucks used in direct payments
              application_fee: platformFee, // 3% fee on full amount
              status: "completed",
              rewards_earned: pawbucksEarned,
              cashback_earned: amountInDollars * 0.1, // 10% cashback value
              stripe_payment_intent_id: paymentIntent.id,
            });

          logStep("Transaction record created with fee tracking");
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { 
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message 
        });

        await supabaseAdmin
          .from("direct_payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logStep("Account updated", { 
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled 
        });

        const isComplete = account.charges_enabled && account.payouts_enabled;

        await supabaseAdmin
          .from("merchants")
          .update({
            onboarding_complete: isComplete,
            stripe_account_status: isComplete ? "active" : "pending",
          })
          .eq("stripe_account_id", account.id);

        break;
      }

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout completed", { 
          payoutId: payout.id,
          amount: payout.amount,
          connectedAccount: connectedAccountId 
        });
        break;
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout;
        logStep("Payout failed", { 
          payoutId: payout.id,
          failureMessage: payout.failure_message,
          connectedAccount: connectedAccountId 
        });
        break;
      }

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("Webhook error", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});
