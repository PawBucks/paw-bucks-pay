import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PROCESS-MERCHANT-SUBSCRIPTIONS] ${step}`, details ? JSON.stringify(details) : "");
};

const PLATFORM_FEE_PERCENT = 0.03; // 3% platform fee

// PawPass product IDs for tier determination
const PAWPASS_PLUS_PRODUCT_ID = 'prod_TQyZjYzt9DwoIK';
const PAWPASS_PRODUCT_ID = 'prod_TJVK9ZhLiJnnpm';

interface SubscriptionToProcess {
  id: string;
  user_id: string;
  stripe_customer_id_on_connected: string;
  merchant_id: string;
  connected_account_id: string;
  stripe_price_id: string;
  product_name: string;
  amount: number;
  currency: string;
  billing_interval: string;
  billing_interval_count: number;
  failed_payment_count: number;
  application_fee_percent: number;
  metadata: Record<string, string> | null;
}

// Helper function to determine user's subscription tier and multiplier
async function getUserTierMultiplier(
  supabaseAdmin: any,
  stripe: Stripe,
  userId: string
): Promise<{ multiplier: number; tierName: string }> {
  let pawbucksMultiplier = 10; // Default 10x for Free tier
  let tierName = 'Free';

  try {
    const { data: platformSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (platformSub?.stripe_subscription_id) {
      const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
      const productId = platformSubscription.items.data[0]?.price?.product;
      
      if (productId === PAWPASS_PLUS_PRODUCT_ID) {
        pawbucksMultiplier = 30; // PawPass+
        tierName = 'PawPass+';
      } else if (productId === PAWPASS_PRODUCT_ID) {
        pawbucksMultiplier = 20; // PawPass
        tierName = 'PawPass';
      }
    }
    logStep("User subscription tier determined", { userId, tierName, pawbucksMultiplier });
  } catch (tierError) {
    logStep("Error determining tier (using default 10x)", { userId, error: String(tierError) });
  }

  return { multiplier: pawbucksMultiplier, tierName };
}

// Helper function to credit PawBucks to user
async function creditPawBucksToUser(
  supabaseAdmin: any,
  userId: string,
  merchantId: string,
  amountInDollars: number,
  multiplier: number,
  tierName: string,
  productName: string
): Promise<number> {
  const pawbucksEarned = Math.floor(amountInDollars * multiplier);
  
  if (pawbucksEarned <= 0) {
    return 0;
  }

  // Log activity with type 'earn'
  const { error: activityError } = await supabaseAdmin
    .from("pawbucks_activity")
    .insert({
      user_id: userId,
      amount: pawbucksEarned,
      type: "earn",
      source: "subscription_renewal",
      description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${multiplier}x) from ${productName} renewal`,
      pawbucks_status: "available",
      partner_id: merchantId,
    });

  if (activityError) {
    logStep("Error inserting pawbucks_activity", { userId, error: activityError.message });
  } else {
    logStep("PawBucks activity logged", { userId, amount: pawbucksEarned, type: "earn" });
  }

  // Update wallet balance
  const { data: wallet } = await supabaseAdmin
    .from('pawbucks_wallet')
    .select('balance')
    .eq('user_id', userId)
    .single();

  if (wallet) {
    const { error: walletError } = await supabaseAdmin
      .from('pawbucks_wallet')
      .update({ balance: wallet.balance + pawbucksEarned })
      .eq('user_id', userId);
    
    if (walletError) {
      logStep("Error updating wallet balance", { userId, error: walletError.message });
    } else {
      logStep("PawBucks wallet updated", { 
        userId,
        previousBalance: wallet.balance, 
        newBalance: wallet.balance + pawbucksEarned,
        earned: pawbucksEarned 
      });
    }
  } else {
    logStep("Wallet not found for user, creating one", { userId });
    await supabaseAdmin.from('pawbucks_wallet').insert({
      user_id: userId,
      balance: pawbucksEarned,
    });
  }

  return pawbucksEarned;
}

// Helper function to credit merchant earnings (1%)
async function creditMerchantEarnings(
  supabaseAdmin: any,
  merchantId: string,
  userId: string,
  amountInDollars: number
): Promise<number> {
  const merchantEarnings = Math.round(amountInDollars * 10); // 1% = 10 PawBucks per dollar
  
  if (merchantEarnings <= 0) {
    return 0;
  }

  const { data: merchantWallet } = await supabaseAdmin
    .from('merchant_pawbucks_wallet')
    .select('balance')
    .eq('merchant_id', merchantId)
    .single();

  const currentBalance = merchantWallet?.balance || 0;
  
  if (merchantWallet) {
    await supabaseAdmin
      .from('merchant_pawbucks_wallet')
      .update({ balance: currentBalance + merchantEarnings })
      .eq('merchant_id', merchantId);
  } else {
    await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
      merchant_id: merchantId,
      balance: merchantEarnings,
    });
  }

  await supabaseAdmin.from('merchant_pawbucks_activity').insert({
    merchant_id: merchantId,
    type: 'earn',
    amount: merchantEarnings,
    source: 'Subscription Commission',
    customer_user_id: userId,
    description: `Earned 1% from $${amountInDollars.toFixed(2)} subscription renewal`,
  });

  logStep("Merchant earnings credited", { merchantId, merchantEarnings });
  return merchantEarnings;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Daily billing cron started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Get all active subscriptions due for billing
    const now = new Date();
    const { data: dueSubscriptions, error: fetchError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("*")
      .eq("status", "active")
      .eq("cancel_at_period_end", false)
      .lte("next_billing_date", now.toISOString())
      .order("next_billing_date", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    logStep("Found subscriptions due for billing", { count: dueSubscriptions?.length || 0 });

    if (!dueSubscriptions || dueSubscriptions.length === 0) {
      return new Response(JSON.stringify({ 
        success: true, 
        message: "No subscriptions due for billing",
        processed: 0 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = {
      processed: 0,
      succeeded: 0,
      failed: 0,
      skipped: 0,
      totalPawBucksAwarded: 0,
      details: [] as Array<{ subscriptionId: string; status: string; pawbucksEarned?: number; error?: string }>,
    };

    // Process each subscription
    for (const subscription of dueSubscriptions as SubscriptionToProcess[]) {
      logStep("Processing subscription", { 
        subscriptionId: subscription.id,
        merchantId: subscription.merchant_id,
        amount: subscription.amount,
      });

      try {
        // SAFETY CHECK: Verify connected account is still active before charging
        logStep("Verifying connected account...", { accountId: subscription.connected_account_id });
        
        let account: Stripe.Account;
        try {
          account = await stripe.accounts.retrieve(subscription.connected_account_id);
        } catch (accountError) {
          // Account may have been deleted or is inaccessible
          logStep("Failed to retrieve connected account", { 
            error: String(accountError),
            subscriptionId: subscription.id 
          });
          
          await handleAccountInactive(supabaseAdmin, subscription, "Connected account is no longer accessible");
          results.skipped++;
          results.details.push({ 
            subscriptionId: subscription.id, 
            status: "skipped", 
            error: "Connected account inaccessible" 
          });
          continue;
        }

        if (!account.charges_enabled) {
          logStep("Connected account cannot accept charges", { 
            accountId: subscription.connected_account_id,
            chargesEnabled: account.charges_enabled,
            requirements: account.requirements?.currently_due,
          });
          
          await handleAccountInactive(supabaseAdmin, subscription, "Merchant account cannot accept payments");
          results.skipped++;
          results.details.push({ 
            subscriptionId: subscription.id, 
            status: "skipped", 
            error: "Merchant account restricted" 
          });
          continue;
        }

        logStep("Connected account verified", { chargesEnabled: true });

        // Get customer's default payment method on connected account
        const customer = await stripe.customers.retrieve(
          subscription.stripe_customer_id_on_connected,
          { expand: ["invoice_settings.default_payment_method"] },
          { stripeAccount: subscription.connected_account_id }
        );

        if (customer.deleted) {
          throw new Error("Customer has been deleted from merchant's Stripe account");
        }

        const defaultPaymentMethod = 
          (customer as Stripe.Customer).invoice_settings?.default_payment_method;
        
        if (!defaultPaymentMethod) {
          throw new Error("No payment method on file");
        }

        const paymentMethodId = typeof defaultPaymentMethod === "string" 
          ? defaultPaymentMethod 
          : defaultPaymentMethod.id;

        // Calculate application fee
        const applicationFee = Math.round(subscription.amount * PLATFORM_FEE_PERCENT);

        // Create PaymentIntent on connected account (off-session)
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: subscription.amount,
            currency: subscription.currency,
            customer: subscription.stripe_customer_id_on_connected,
            payment_method: paymentMethodId,
            off_session: true, // Recurring payment without customer present
            confirm: true,
            application_fee_amount: applicationFee,
            description: `${subscription.product_name} subscription renewal`,
            metadata: {
              merchant_subscription_id: subscription.id,
              merchant_id: subscription.merchant_id,
              user_id: subscription.user_id,
              subscription_type: "merchant_recurring",
              billing_type: "renewal",
              platform: "pawbucks",
            },
          },
          { stripeAccount: subscription.connected_account_id }
        );

        logStep("PaymentIntent created", { 
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status 
        });

        if (paymentIntent.status === "succeeded") {
          // Payment succeeded - update subscription and credit PawBucks
          const pawbucksEarned = await handlePaymentSuccess(
            supabaseAdmin, 
            stripe,
            subscription, 
            paymentIntent.id,
            applicationFee
          );
          results.succeeded++;
          results.totalPawBucksAwarded += pawbucksEarned;
          results.details.push({ subscriptionId: subscription.id, status: "succeeded", pawbucksEarned });
        } else {
          // Payment requires action or has issues
          await handlePaymentFailed(
            supabaseAdmin, 
            subscription, 
            paymentIntent.id, 
            `Payment status: ${paymentIntent.status}`
          );
          results.failed++;
          results.details.push({ 
            subscriptionId: subscription.id, 
            status: "failed",
            error: `Payment requires action: ${paymentIntent.status}` 
          });
        }

      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        logStep("Error processing subscription", { 
          subscriptionId: subscription.id, 
          error: errorMessage 
        });

        await handlePaymentFailed(supabaseAdmin, subscription, null, errorMessage);
        results.failed++;
        results.details.push({ 
          subscriptionId: subscription.id, 
          status: "failed",
          error: errorMessage 
        });
      }

      results.processed++;
    }

    logStep("Billing run complete", results);

    return new Response(JSON.stringify({
      success: true,
      ...results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

// Handle successful payment - now includes PawBucks rewards
async function handlePaymentSuccess(
  supabase: any,
  stripe: Stripe,
  subscription: SubscriptionToProcess,
  paymentIntentId: string,
  applicationFee: number
): Promise<number> {
  const now = new Date();
  
  // Calculate next billing date
  const nextBilling = new Date(now);
  switch (subscription.billing_interval) {
    case "day":
      nextBilling.setDate(nextBilling.getDate() + subscription.billing_interval_count);
      break;
    case "week":
      nextBilling.setDate(nextBilling.getDate() + (7 * subscription.billing_interval_count));
      break;
    case "month":
      nextBilling.setMonth(nextBilling.getMonth() + subscription.billing_interval_count);
      break;
    case "year":
      nextBilling.setFullYear(nextBilling.getFullYear() + subscription.billing_interval_count);
      break;
  }

  // Update subscription
  await supabase
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: now.toISOString(),
      current_period_end: nextBilling.toISOString(),
      next_billing_date: nextBilling.toISOString(),
      last_payment_date: now.toISOString(),
      last_payment_intent_id: paymentIntentId,
      last_payment_status: "succeeded",
      failed_payment_count: 0,
    })
    .eq("id", subscription.id);

  // Log event
  await supabase.from("merchant_subscription_events").insert({
    subscription_id: subscription.id,
    event_type: "renewed",
    amount: subscription.amount,
    payment_intent_id: paymentIntentId,
  });

  // === PAWBUCKS REWARDS PROCESSING ===
  const amountInDollars = subscription.amount / 100;

  // Get user's subscription tier for multiplier
  const { multiplier, tierName } = await getUserTierMultiplier(supabase, stripe, subscription.user_id);

  // Credit PawBucks to user
  const pawbucksEarned = await creditPawBucksToUser(
    supabase,
    subscription.user_id,
    subscription.merchant_id,
    amountInDollars,
    multiplier,
    tierName,
    subscription.product_name
  );

  // Credit merchant 1% earnings
  await creditMerchantEarnings(supabase, subscription.merchant_id, subscription.user_id, amountInDollars);

  // Auto-log platform fee as Tax Vault expense
  if (applicationFee > 0) {
    const expenseDate = new Date().toISOString().split('T')[0];
    const taxYear = new Date().getFullYear();

    await supabase
      .from("merchant_tax_expenses")
      .insert({
        merchant_id: subscription.merchant_id,
        category: "platform_fees",
        amount: applicationFee / 100, // Convert to dollars
        description: `Platform Fee (3%) on $${amountInDollars.toFixed(2)} subscription renewal`,
        vendor_name: "PawBucks Platform",
        expense_date: expenseDate,
        tax_year: taxYear,
        is_auto_logged: true,
        source_purchase_id: paymentIntentId,
      });

    logStep("Platform fee auto-logged to Tax Vault", { subscriptionId: subscription.id });
  }

  // Send notification to user about renewal and rewards
  await supabase.from("notifications").insert({
    user_id: subscription.user_id,
    title: "Subscription Renewed",
    message: `Your ${subscription.product_name} subscription has been renewed. You earned ${pawbucksEarned} PawBucks!`,
    category: "transactional",
  });

  logStep("Payment success recorded with PawBucks", { 
    subscriptionId: subscription.id,
    nextBilling: nextBilling.toISOString(),
    pawbucksEarned,
    tierName
  });

  return pawbucksEarned;
}

// Handle failed payment
async function handlePaymentFailed(
  supabase: any,
  subscription: SubscriptionToProcess,
  paymentIntentId: string | null,
  failureReason: string
) {
  const newFailedCount = subscription.failed_payment_count + 1;
  const newStatus = newFailedCount >= 3 ? "canceled" : "past_due";

  // Update subscription status
  await supabase
    .from("merchant_subscriptions")
    .update({
      status: newStatus,
      last_payment_intent_id: paymentIntentId,
      last_payment_status: "failed",
      failed_payment_count: newFailedCount,
      canceled_at: newStatus === "canceled" ? new Date().toISOString() : null,
    })
    .eq("id", subscription.id);

  // Log event
  await supabase.from("merchant_subscription_events").insert({
    subscription_id: subscription.id,
    event_type: "payment_failed",
    amount: subscription.amount,
    payment_intent_id: paymentIntentId,
    failure_reason: failureReason,
    metadata: { failed_count: newFailedCount },
  });

  // Get user email for notification
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("id", subscription.user_id)
    .single();

  // Send notification to user
  await supabase.from("notifications").insert({
    user_id: subscription.user_id,
    title: newStatus === "canceled" 
      ? "Subscription Canceled" 
      : "Payment Failed",
    message: newStatus === "canceled"
      ? `Your subscription to ${subscription.product_name} has been canceled after ${newFailedCount} failed payment attempts. Please update your payment method to resubscribe.`
      : `Payment failed for your ${subscription.product_name} subscription. Please update your payment method to avoid cancellation.`,
    category: "transactional",
  });

  logStep("Payment failure recorded", { 
    subscriptionId: subscription.id,
    failedCount: newFailedCount,
    newStatus,
    reason: failureReason 
  });
}

// Handle inactive connected account
async function handleAccountInactive(
  supabase: any,
  subscription: SubscriptionToProcess,
  reason: string
) {
  // Pause the subscription - don't cancel as merchant might fix their account
  await supabase
    .from("merchant_subscriptions")
    .update({
      status: "paused",
    })
    .eq("id", subscription.id);

  // Log event
  await supabase.from("merchant_subscription_events").insert({
    subscription_id: subscription.id,
    event_type: "paused",
    failure_reason: reason,
    metadata: { reason: "merchant_account_inactive" },
  });

  // Notify user
  await supabase.from("notifications").insert({
    user_id: subscription.user_id,
    title: "Subscription Paused",
    message: `Your subscription to ${subscription.product_name} has been temporarily paused because the merchant's payment account is unavailable. We'll try again once the issue is resolved.`,
    category: "transactional",
  });

  // Also update merchant status
  await supabase
    .from("merchants")
    .update({ onboarding_complete: false })
    .eq("id", subscription.merchant_id);

  logStep("Subscription paused due to inactive account", { 
    subscriptionId: subscription.id,
    reason 
  });
}
