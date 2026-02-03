import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONNECT-WEBHOOK] ${step}`, details ? JSON.stringify(details) : "");
};

// Helper function to send receipt email
async function sendReceiptEmail(params: {
  email: string;
  customerName?: string;
  transactionDate: string;
  receiptId: string;
  merchantName: string;
  items: { name: string; price: number }[];
  subtotal: number;
  pawbucksApplied: number;
  cardAmount: number;
  totalPaid: number;
  pawbucksEarned?: number;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      logStep("Skipping receipt email: config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send receipt email:", errorText);
    } else {
      logStep(`Receipt email sent to ${params.email}`);
    }
  } catch (error) {
    console.error("Error sending receipt email:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received", { method: req.method });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    // Try connected account secret first, then platform secret
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET") || Deno.env.get("STRIPE_PLATFORM_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("No webhook secret configured");

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    const body = await req.text();
    
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      // Try alternate secret
      const altSecret = Deno.env.get("STRIPE_PLATFORM_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (altSecret && altSecret !== webhookSecret) {
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, altSecret);
          logStep("Verified with alternate webhook secret");
        } catch {
          logStep("Webhook signature verification failed with both secrets", { error: String(err) });
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
        }
      } else {
        logStep("Webhook signature verification failed", { error: String(err) });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    }

    logStep("Event verified", { type: event.type, id: event.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // IDEMPOTENCY CHECK: Skip if already processed
    const { data: existingLog } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingLog) {
      logStep('Duplicate event, skipping', { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    // Log the event
    await supabaseAdmin.from('webhook_logs').insert({
      event_id: event.id,
      event_type: event.type,
      payload: event as any,
      processed: false,
    });

    // Connected account context (for Direct Charges)
    const connectedAccountId = event.account;
    if (connectedAccountId) {
      logStep("Event from connected account", { accountId: connectedAccountId });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        
        logStep("Processing payment_intent.succeeded", { 
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata,
          connectedAccount: connectedAccountId,
        });

        // Check if transaction already exists (idempotency)
        const { data: existingTx } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (existingTx) {
          logStep('Transaction already exists, skipping', { transactionId: existingTx.id });
          
          // Mark webhook as processed
          await supabaseAdmin.from('webhook_logs')
            .update({ processed: true })
            .eq('event_id', event.id);
            
          return new Response(JSON.stringify({ received: true, skipped: 'already_processed' }), { status: 200 });
        }

        const metadata = paymentIntent.metadata || {};
        const userId = metadata.user_id;
        const merchantId = metadata.merchant_id;
        const businessName = metadata.business_name || "Merchant";
        const description = metadata.description || `Payment to ${businessName}`;
        const chargeType = metadata.charge_type || "direct";
        const pawbucksAmount = parseInt(metadata.pawbucks_amount || "0", 10);
        const totalAmount = parseFloat(metadata.total_amount || "0");

        // Update direct_payments status
        const { error: updateError } = await supabaseAdmin
          .from("direct_payments")
          .update({ status: "succeeded" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("Error updating direct_payment status", { error: updateError.message });
        } else {
          logStep("Direct payment status updated to succeeded");
        }

        // Calculate amounts
        const amountInDollars = paymentIntent.amount / 100;
        const platformFee = amountInDollars * 0.03; // 3% platform fee

        // Determine PawBucks multiplier based on subscription tier
        let pawbucksMultiplier = 10;
        let tierName = 'Free';

        if (userId) {
          try {
            // Check for manual subscription first
            const { data: platformSub } = await supabaseAdmin
              .from('subscriptions')
              .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at')
              .eq('user_id', userId)
              .in('status', ['active', 'trialing'])
              .maybeSingle();

            if (platformSub?.is_manual_upgrade && platformSub?.subscription_tier) {
              const expiresAt = platformSub.expires_at ? new Date(platformSub.expires_at) : null;
              if (!expiresAt || expiresAt > new Date()) {
                if (platformSub.subscription_tier === 'pawpass_plus') {
                  pawbucksMultiplier = 30;
                  tierName = 'PawPass+';
                } else if (platformSub.subscription_tier === 'pawpass') {
                  pawbucksMultiplier = 20;
                  tierName = 'PawPass';
                }
              }
            } else if (platformSub?.stripe_subscription_id) {
              const stripeSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
              const productId = stripeSubscription.items.data[0]?.price?.product;
              
              if (productId === 'prod_TQyZjYzt9DwoIK') {
                pawbucksMultiplier = 30;
                tierName = 'PawPass+';
              } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
                pawbucksMultiplier = 20;
                tierName = 'PawPass';
              }
            }
            logStep("Subscription tier determined", { tierName, pawbucksMultiplier });
          } catch (subError) {
            logStep("Error determining subscription tier", { error: String(subError) });
          }
        }

        // PawBucks earned on Stripe amount only
        const pawbucksEarned = Math.floor(amountInDollars * pawbucksMultiplier);

        // Create transaction record
        if (userId && merchantId) {
          const { data: transaction, error: txError } = await supabaseAdmin
            .from("transactions")
            .insert({
              user_id: userId,
              merchant_id: merchantId,
              amount: totalAmount > 0 ? totalAmount : amountInDollars,
              stripe_amount: amountInDollars,
              pawbucks_used: pawbucksAmount,
              application_fee: platformFee,
              status: "completed",
              rewards_earned: pawbucksEarned,
              cashback_earned: pawbucksEarned,
              stripe_payment_intent_id: paymentIntent.id,
              description: description,
            })
            .select()
            .single();

          if (txError) {
            logStep("Error creating transaction", { error: txError.message });
          } else {
            logStep("Transaction created", { transactionId: transaction?.id, pawbucksEarned });
          }

          // Award PawBucks to user
          if (pawbucksEarned > 0) {
            // Log activity - MUST be 'earn' type for wallet display
            await supabaseAdmin.from("pawbucks_activity").insert({
              user_id: userId,
              amount: pawbucksEarned,
              type: "earn",
              source: "direct_payment",
              description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from payment to ${businessName}`,
              pawbucks_status: "available",
              partner_id: merchantId,
              transaction_id: transaction?.id,
            });

            // Update wallet balance
            const { data: wallet } = await supabaseAdmin
              .from('pawbucks_wallet')
              .select('balance')
              .eq('user_id', userId)
              .single();

            if (wallet) {
              await supabaseAdmin
                .from('pawbucks_wallet')
                .update({ balance: wallet.balance + pawbucksEarned })
                .eq('user_id', userId);
              
              logStep("PawBucks wallet updated", { 
                previousBalance: wallet.balance, 
                newBalance: wallet.balance + pawbucksEarned 
              });
            } else {
              // Create wallet if doesn't exist
              await supabaseAdmin.from('pawbucks_wallet').insert({
                user_id: userId,
                balance: pawbucksEarned,
              });
              logStep("PawBucks wallet created with initial balance");
            }
          }

          // Auto-log platform fee as Tax Vault expense
          if (platformFee > 0) {
            const expenseDate = new Date().toISOString().split('T')[0];
            const taxYear = new Date().getFullYear();

            await supabaseAdmin.from("merchant_tax_expenses").insert({
              merchant_id: merchantId,
              category: "platform_fees",
              amount: platformFee,
              description: `Platform/Processing Fee (3%) on $${amountInDollars.toFixed(2)} sale`,
              vendor_name: "PawBucks Platform",
              expense_date: expenseDate,
              tax_year: taxYear,
              is_auto_logged: true,
              source_purchase_id: paymentIntent.id,
            });

            logStep("Platform fee auto-logged to Tax Vault");
          }

          // Send receipt email
          const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();

          if (userProfile?.email) {
            await sendReceiptEmail({
              email: userProfile.email,
              customerName: userProfile.full_name || undefined,
              transactionDate: new Date().toISOString(),
              receiptId: transaction?.id || paymentIntent.id,
              merchantName: businessName,
              items: [{ name: description, price: totalAmount > 0 ? totalAmount : amountInDollars }],
              subtotal: totalAmount > 0 ? totalAmount : amountInDollars,
              pawbucksApplied: pawbucksAmount * 0.001,
              cardAmount: amountInDollars,
              totalPaid: totalAmount > 0 ? totalAmount : amountInDollars,
              pawbucksEarned,
            });
          }
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
          payoutsEnabled: account.payouts_enabled,
        });

        const isComplete = account.charges_enabled && account.payouts_enabled;
        const hasPendingRequirements = 
          (account.requirements?.currently_due?.length || 0) > 0 ||
          (account.requirements?.past_due?.length || 0) > 0;

        await supabaseAdmin
          .from("merchants")
          .update({
            onboarding_complete: isComplete && !hasPendingRequirements,
            stripe_account_status: isComplete ? "active" : "pending",
          })
          .eq("stripe_account_id", account.id);

        break;
      }

      case "payout.paid":
      case "payout.failed":
      case "transfer.created":
        logStep("Handled event", { type: event.type });
        break;

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // Mark as processed
    await supabaseAdmin.from('webhook_logs')
      .update({ processed: true })
      .eq('event_id', event.id);

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CONNECT-WEBHOOK] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});