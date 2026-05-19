import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
const DEFAULT_BILLING_TIMEZONE = "America/New_York";
const BILLING_LOCAL_HOUR = 12; // Noon local time avoids UTC day-boundary drift.

// PawPass product IDs for tier determination
const PAWPASS_PLUS_PRODUCT_ID = 'prod_TQyZjYzt9DwoIK';
const PAWPASS_PRODUCT_ID = 'prod_TJVK9ZhLiJnnpm';

// PawBucks → USD conversion (1000 PB = $1.00)
const PAWBUCKS_TO_USD = 0.001;

/**
 * Determine how many PawBucks to auto-apply to a recurring subscription charge
 * based on the user's auto_redeem preference. Returns 0 if auto-redeem is off
 * or if smart-mode coverage thresholds are not met.
 *
 * amountCents: full subscription amount about to be charged
 * Returns: { pawbucksToUse, pawbucksUsdValue, mode }
 */
async function computeAutoRedeem(
  supabaseAdmin: any,
  userId: string,
  amountCents: number,
): Promise<{ pawbucksToUse: number; pawbucksUsdValue: number; mode: string }> {
  try {
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct')
      .eq('id', userId)
      .maybeSingle();

    const mode = (profile?.auto_redeem_mode as string) || 'off';
    const minCoveragePct = profile?.auto_redeem_min_coverage_pct ?? 20;
    const maxApplyPct = profile?.auto_redeem_max_apply_pct ?? 50;

    // Recurring subscription renewal: trigger on 'subscriptions_only', 'always', or 'smart'
    if (mode !== 'subscriptions_only' && mode !== 'always' && mode !== 'smart') {
      return { pawbucksToUse: 0, pawbucksUsdValue: 0, mode };
    }

    const { data: wallet } = await supabaseAdmin
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', userId)
      .maybeSingle();

    const availablePB = wallet?.balance ?? 0;
    if (availablePB <= 0) {
      return { pawbucksToUse: 0, pawbucksUsdValue: 0, mode };
    }

    const amountDollars = amountCents / 100;
    let pawbucksToUse = 0;

    if (mode === 'always' || mode === 'subscriptions_only') {
      // Apply as many PawBucks as possible, up to the full charge
      const maxNeededPB = Math.floor(amountDollars / PAWBUCKS_TO_USD);
      pawbucksToUse = Math.min(availablePB, maxNeededPB);
    } else if (mode === 'smart') {
      // Only apply if PawBucks meaningfully cover the charge
      const coverageDollars = availablePB * PAWBUCKS_TO_USD;
      const coveragePct = (coverageDollars / amountDollars) * 100;
      if (coveragePct >= minCoveragePct) {
        const capDollars = (amountDollars * maxApplyPct) / 100;
        const capPB = Math.floor(capDollars / PAWBUCKS_TO_USD);
        const maxNeededPB = Math.floor(amountDollars / PAWBUCKS_TO_USD);
        pawbucksToUse = Math.min(availablePB, capPB, maxNeededPB);
      }
    }

    // Stripe still needs a minimum charge (Stripe minimum is $0.50 = 50¢).
    // Reserve at least 50¢ in cents for the card if any cents remain after redemption.
    const pawbucksValueCents = Math.round(pawbucksToUse * PAWBUCKS_TO_USD * 100);
    const remainingCents = amountCents - pawbucksValueCents;
    if (remainingCents > 0 && remainingCents < 50) {
      // Pull back PawBucks to leave at least $0.50 on the card
      const pullBackCents = 50 - remainingCents;
      const pullBackPB = Math.ceil(pullBackCents / (PAWBUCKS_TO_USD * 100));
      pawbucksToUse = Math.max(0, pawbucksToUse - pullBackPB);
    }

    const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
    return { pawbucksToUse, pawbucksUsdValue, mode };
  } catch (err) {
    logStep('Error computing auto-redeem (skipping)', { userId, error: String(err) });
    return { pawbucksToUse: 0, pawbucksUsdValue: 0, mode: 'off' };
  }
}

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
  next_billing_date: string;
  metadata: Record<string, string> | null;
  merchants?: { timezone?: string | null } | null;
  profiles?: { timezone?: string | null } | null;
}

function safeTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_BILLING_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_BILLING_TIMEZONE;
  }
}

function getBillingTimeZone(subscription: Pick<SubscriptionToProcess, "merchants" | "profiles">): string {
  return safeTimeZone(subscription.merchants?.timezone || subscription.profiles?.timezone || DEFAULT_BILLING_TIMEZONE);
}

function getDateTimeParts(date: Date, timeZone: string): Record<string, number> {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  return Object.fromEntries(parts.filter((p) => p.type !== "literal").map((p) => [p.type, Number(p.value)]));
}

function formatDateInTimeZone(date: Date, timeZone: string): string {
  const parts = getDateTimeParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = getDateTimeParts(date, timeZone);
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return asUtc - date.getTime();
}

function localDateTimeToUtc(dateString: string, timeZone: string, hour = BILLING_LOCAL_HOUR): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  let utcMs = localAsUtc;
  for (let i = 0; i < 3; i++) {
    utcMs = localAsUtc - timeZoneOffsetMs(new Date(utcMs), timeZone);
  }
  return new Date(utcMs);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addBillingIntervalToLocalDate(dateString: string, interval: string, count: number): string {
  const [year, month, day] = dateString.split("-").map(Number);
  if (interval === "month") {
    const targetMonthIndex = month - 1 + count;
    const targetYear = year + Math.floor(targetMonthIndex / 12);
    const targetMonth = ((targetMonthIndex % 12) + 12) % 12 + 1;
    const targetDay = Math.min(day, daysInMonth(targetYear, targetMonth));
    return `${targetYear}-${String(targetMonth).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
  }
  if (interval === "year") {
    const targetYear = year + count;
    const targetDay = Math.min(day, daysInMonth(targetYear, month));
    return `${targetYear}-${String(month).padStart(2, "0")}-${String(targetDay).padStart(2, "0")}`;
  }
  const daysToAdd = interval === "week" ? count * 7 : count;
  const next = new Date(Date.UTC(year, month - 1, day + daysToAdd, 12, 0, 0));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

function isSubscriptionDueLocally(subscription: SubscriptionToProcess, now: Date): boolean {
  const timeZone = getBillingTimeZone(subscription);
  const dueLocalDate = formatDateInTimeZone(new Date(subscription.next_billing_date), timeZone);
  const todayLocalDate = formatDateInTimeZone(now, timeZone);
  return dueLocalDate <= todayLocalDate;
}

function calculateNextBillingInstant(subscription: SubscriptionToProcess): Date {
  const timeZone = getBillingTimeZone(subscription);
  const currentDueLocalDate = formatDateInTimeZone(new Date(subscription.next_billing_date), timeZone);
  const nextDueLocalDate = addBillingIntervalToLocalDate(
    currentDueLocalDate,
    subscription.billing_interval,
    subscription.billing_interval_count,
  );
  return localDateTimeToUtc(nextDueLocalDate, timeZone);
}

function calculateCurrentBillingInstant(subscription: SubscriptionToProcess): Date {
  const timeZone = getBillingTimeZone(subscription);
  const currentDueLocalDate = formatDateInTimeZone(new Date(subscription.next_billing_date), timeZone);
  return localDateTimeToUtc(currentDueLocalDate, timeZone);
}

// Helper function to determine user's subscription tier and multiplier
// Uses dual-verification: checks both subscription_tier field (for manual upgrades)
// and Stripe product IDs (for purchased subscriptions)
async function getUserTierMultiplier(
  supabaseAdmin: any,
  stripe: Stripe,
  userId: string
): Promise<{ multiplier: number; tierName: string }> {
  let pawbucksMultiplier = 10; // Default 10x for Free tier
  let tierName = 'Free';

  try {
    // First, check for active subscription in database (handles both manual and Stripe upgrades)
    const { data: platformSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (platformSub) {
      // Check for manual upgrade tier first (takes priority as it's directly set)
      if (platformSub.is_manual_upgrade && platformSub.subscription_tier) {
        const tier = platformSub.subscription_tier.toLowerCase();
        if (tier === 'pawpass_plus' || tier === 'plus') {
          pawbucksMultiplier = 30; // PawPass+
          tierName = 'PawPass+';
          console.log(`[PROCESS-MERCHANT-SUBSCRIPTIONS] Manual upgrade tier detected: ${platformSub.subscription_tier} -> ${pawbucksMultiplier}x`);
        } else if (tier === 'pawpass' || tier === 'basic') {
          pawbucksMultiplier = 20; // PawPass
          tierName = 'PawPass';
          console.log(`[PROCESS-MERCHANT-SUBSCRIPTIONS] Manual upgrade tier detected: ${platformSub.subscription_tier} -> ${pawbucksMultiplier}x`);
        }
      } 
      // If not a manual upgrade, check Stripe subscription
      else if (platformSub.stripe_subscription_id) {
        const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
        const productId = platformSubscription.items.data[0]?.price?.product;
        
        if (productId === PAWPASS_PLUS_PRODUCT_ID) {
          pawbucksMultiplier = 30; // PawPass+
          tierName = 'PawPass+';
        } else if (productId === PAWPASS_PRODUCT_ID) {
          pawbucksMultiplier = 20; // PawPass
          tierName = 'PawPass';
        }
        console.log(`[PROCESS-MERCHANT-SUBSCRIPTIONS] Stripe subscription tier detected: ${productId} -> ${pawbucksMultiplier}x`);
      }
      // Also check subscription_tier field even for non-manual upgrades (fallback)
      else if (platformSub.subscription_tier) {
        const tier = platformSub.subscription_tier.toLowerCase();
        if (tier === 'pawpass_plus' || tier === 'plus') {
          pawbucksMultiplier = 30;
          tierName = 'PawPass+';
        } else if (tier === 'pawpass' || tier === 'basic') {
          pawbucksMultiplier = 20;
          tierName = 'PawPass';
        }
        console.log(`[PROCESS-MERCHANT-SUBSCRIPTIONS] Subscription tier field used as fallback: ${platformSub.subscription_tier} -> ${pawbucksMultiplier}x`);
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

// Merchants do NOT earn PawBucks from sales/subscriptions.
// They only receive PawBucks when a Pet Owner pays them WITH PawBucks.

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

    // Get active subscription candidates, then decide due status by the merchant/user local calendar date.
    const now = new Date();
    const localDueLookahead = new Date(now.getTime() + 36 * 60 * 60 * 1000);
    const { data: dueSubscriptionCandidates, error: fetchError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("*, merchants(timezone), profiles(timezone)")
      .eq("status", "active")
      .eq("cancel_at_period_end", false)
      .lte("next_billing_date", localDueLookahead.toISOString())
      .order("next_billing_date", { ascending: true });

    if (fetchError) {
      throw new Error(`Failed to fetch subscriptions: ${fetchError.message}`);
    }

    const dueSubscriptions = (dueSubscriptionCandidates || []).filter((subscription: SubscriptionToProcess) =>
      isSubscriptionDueLocally(subscription, now),
    );

    logStep("Found subscriptions due for billing", {
      candidates: dueSubscriptionCandidates?.length || 0,
      due: dueSubscriptions.length,
      billingMode: "local_date_et_pt",
    });

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

    // Deduplicate: group by user_id + merchant_id + stripe_price_id, keep only the oldest
    const seenKeys = new Set<string>();
    const deduplicatedSubscriptions: SubscriptionToProcess[] = [];
    for (const sub of (dueSubscriptions as SubscriptionToProcess[])) {
      const key = `${sub.user_id}:${sub.merchant_id}:${sub.stripe_price_id}`;
      if (seenKeys.has(key)) {
        logStep("SKIPPING DUPLICATE subscription (same user/merchant/price already queued)", {
          subscriptionId: sub.id,
          userId: sub.user_id,
          merchantId: sub.merchant_id,
        });
        // Auto-cancel the duplicate
        await supabaseAdmin
          .from("merchant_subscriptions")
          .update({ status: "canceled", canceled_at: new Date().toISOString() })
          .eq("id", sub.id);
        results.skipped++;
        results.details.push({ subscriptionId: sub.id, status: "skipped", error: "Duplicate subscription auto-canceled" });
        continue;
      }
      seenKeys.add(key);
      deduplicatedSubscriptions.push(sub);
    }

    // Process each subscription
    for (const subscription of deduplicatedSubscriptions) {
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

        // === AUTO-REDEEM PAWBUCKS ===
        // Apply user's auto-redeem preference to reduce the Stripe charge
        const autoRedeem = await computeAutoRedeem(
          supabaseAdmin,
          subscription.user_id,
          subscription.amount,
        );
        const pawbucksToUse = autoRedeem.pawbucksToUse;
        const pawbucksValueCents = Math.round(pawbucksToUse * PAWBUCKS_TO_USD * 100);
        const stripeChargeAmount = subscription.amount - pawbucksValueCents;

        logStep("Auto-redeem decision", {
          subscriptionId: subscription.id,
          mode: autoRedeem.mode,
          pawbucksToUse,
          pawbucksValueCents,
          stripeChargeAmount,
          fullAmount: subscription.amount,
        });

        // If PawBucks fully cover the charge, skip Stripe entirely
        if (stripeChargeAmount <= 0 && pawbucksToUse > 0) {
          await handleFullPawBucksRenewal(
            supabaseAdmin,
            stripe,
            subscription,
            pawbucksToUse,
            pawbucksValueCents,
          );
          results.succeeded++;
          results.details.push({ subscriptionId: subscription.id, status: "succeeded", pawbucksEarned: 0 });
          results.processed++;
          continue;
        }

        // Calculate application fee on the Stripe-charged portion only
        const applicationFee = Math.round(stripeChargeAmount * PLATFORM_FEE_PERCENT);

        // Create PaymentIntent on connected account (off-session)
        const paymentIntent = await stripe.paymentIntents.create(
          {
            amount: stripeChargeAmount,
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
              pawbucks_used: String(pawbucksToUse),
              auto_redeem_mode: autoRedeem.mode,
            },
          },
          { stripeAccount: subscription.connected_account_id }
        );

        logStep("PaymentIntent created", { 
          paymentIntentId: paymentIntent.id,
          status: paymentIntent.status,
          stripeAmount: stripeChargeAmount,
          pawbucksApplied: pawbucksToUse,
        });

        if (paymentIntent.status === "succeeded") {
          // Deduct redeemed PawBucks from wallet now that the charge succeeded
          if (pawbucksToUse > 0) {
            await debitPawBucksForRedemption(
              supabaseAdmin,
              subscription.user_id,
              subscription.merchant_id,
              pawbucksToUse,
              subscription.product_name,
              paymentIntent.id,
            );
          }

          // Payment succeeded - update subscription and credit PawBucks
          const pawbucksEarned = await handlePaymentSuccess(
            supabaseAdmin, 
            stripe,
            subscription, 
            paymentIntent.id,
            applicationFee,
            pawbucksToUse,
            stripeChargeAmount,
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
  applicationFee: number,
  pawbucksUsed: number = 0,
  stripeChargeAmount?: number,
): Promise<number> {
  const now = new Date();
  const currentBilling = calculateCurrentBillingInstant(subscription);
  // Use the actual Stripe-charged portion for fee logging and rewards calculation;
  // fall back to the full subscription amount for legacy callers.
  const chargedCents = typeof stripeChargeAmount === "number" ? stripeChargeAmount : subscription.amount;
  const pawbucksValueCents = Math.round(pawbucksUsed * PAWBUCKS_TO_USD * 100);
  const fullAmountDollars = subscription.amount / 100;
  const chargedDollars = chargedCents / 100;
  const pawbucksUsdValue = pawbucksValueCents / 100;
  
  const nextBilling = calculateNextBillingInstant(subscription);

  // Update subscription
  await supabase
    .from("merchant_subscriptions")
    .update({
      status: "active",
      current_period_start: currentBilling.toISOString(),
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
  // Earn PawBucks only on the Stripe-charged portion (consistent with policy that
  // rewards are not earned on PawBucks-redeemed amounts).
  const amountInDollars = chargedDollars;

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

  // Auto-log success fee as Tax Vault expense
  if (applicationFee > 0) {
    const expenseDate = new Date().toISOString().split('T')[0];
    const taxYear = new Date().getFullYear();

    await supabase
      .from("merchant_tax_expenses")
      .insert({
        merchant_id: subscription.merchant_id,
        category: "platform_fees",
        amount: applicationFee / 100, // Convert to dollars
        description: `PawBucks Success Fee (3%) on $${chargedDollars.toFixed(2)} subscription renewal (card portion)`,
        vendor_name: "PawBucks Network",
        expense_date: expenseDate,
        tax_year: taxYear,
        is_auto_logged: true,
        source_purchase_id: paymentIntentId,
      });

    logStep("Success fee auto-logged to Tax Vault", { subscriptionId: subscription.id });
  }

  // === CREATE TRANSACTION RECORD ===
  // This ensures subscription renewals appear in both merchant and owner transaction history
  const platformFeeInDollars = applicationFee / 100;
  const { data: txRecord, error: txError } = await supabase
    .from("transactions")
    .insert({
      user_id: subscription.user_id,
      merchant_id: subscription.merchant_id,
      amount: fullAmountDollars,
      stripe_amount: chargedDollars,
      pawbucks_used: pawbucksUsed,
      application_fee: platformFeeInDollars,
      cashback_earned: pawbucksEarned,
      rewards_earned: pawbucksEarned,
      description: pawbucksUsed > 0
        ? `${subscription.product_name} subscription renewal (auto-redeemed ${pawbucksUsed} PB)`
        : `${subscription.product_name} subscription renewal`,
      status: "completed",
      stripe_payment_intent_id: paymentIntentId,
      payment_method: pawbucksUsed > 0 ? "mixed" : "card",
    })
    .select()
    .single();

  if (txError) {
    logStep("Error creating transaction record", { subscriptionId: subscription.id, error: txError.message });
  } else {
    logStep("Transaction record created", { transactionId: txRecord?.id, amount: fullAmountDollars, pawbucksUsed });
  }

  // Send notification to user about renewal and rewards
  const renewalNotice = pawbucksUsed > 0
    ? `Your ${subscription.product_name} subscription renewed. We auto-redeemed ${pawbucksUsed.toLocaleString()} PawBucks ($${pawbucksUsdValue.toFixed(2)}) and charged $${chargedDollars.toFixed(2)}. You earned ${pawbucksEarned} PawBucks.`
    : `Your ${subscription.product_name} subscription has been renewed. You earned ${pawbucksEarned} PawBucks!`;
  await supabase.from("notifications").insert({
    user_id: subscription.user_id,
    title: "Subscription Renewed",
    message: renewalNotice,
    category: "transactional",
  });

  // === SEND RECEIPT EMAIL TO CUSTOMER ===
  try {
    const { data: userProfile } = await supabase
      .from('profiles')
      .select('email, full_name')
      .eq('id', subscription.user_id)
      .single();

    const { data: merchantData } = await supabase
      .from('merchants')
      .select('business_name, user_id, address')
      .eq('id', subscription.merchant_id)
      .single();

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

    if (userProfile?.email && supabaseUrl && supabaseAnonKey) {
      // Send receipt email to customer
      await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          email: userProfile.email,
          customerName: userProfile.full_name || undefined,
          transactionDate: new Date().toISOString(),
          receiptId: paymentIntentId || subscription.id,
          merchantName: merchantData?.business_name || subscription.product_name,
          merchantLocation: merchantData?.address || undefined,
          items: [{ name: `${subscription.product_name} Subscription (Renewal)`, price: fullAmountDollars }],
          subtotal: fullAmountDollars,
          pawbucksApplied: pawbucksUsed,
          cardAmount: chargedDollars,
          totalPaid: fullAmountDollars,
          pawbucksEarned,
          tierInfo: { tierName, multiplier },
        }),
      });

      logStep("Renewal receipt email sent", { email: userProfile.email });
    }

    // Send in-app notification to merchant
    if (merchantData?.user_id) {
      await supabase.from("notifications").insert({
        user_id: merchantData.user_id,
        title: "💰 Subscription Renewal Payment",
        message: `${userProfile?.full_name || 'A customer'}'s ${subscription.product_name} subscription renewed for $${amountInDollars.toFixed(2)}.`,
        category: "transactional",
      });

      // Send payment received email to merchant
      const { data: merchantProfile } = await supabase
        .from('profiles')
        .select('email, full_name')
        .eq('id', merchantData.user_id)
        .single();

      if (merchantProfile?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-invoice-paid-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${supabaseAnonKey}`,
          },
          body: JSON.stringify({
            merchantEmail: merchantProfile.email,
            merchantName: merchantData.business_name || merchantProfile.full_name || 'Merchant',
            invoiceNumber: `RENEWAL-${Date.now().toString(36).toUpperCase()}`,
            invoiceTitle: `${subscription.product_name} Subscription Renewal`,
            clientName: userProfile?.full_name || 'Customer',
            clientEmail: userProfile?.email || '',
            amountPaid: amountInDollars,
            pawbucksUsed: 0,
            paymentMethod: 'credit_card',
            paymentDate: new Date().toISOString(),
            invoiceTotal: amountInDollars,
            amountDue: 0,
          }),
        });

        logStep("Merchant renewal notification sent", { email: merchantProfile.email });
      }
    }
  } catch (emailError) {
    // Don't fail the renewal for email errors
    logStep("Error sending renewal emails", { error: String(emailError) });
  }

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

// Debit redeemed PawBucks from user's wallet and log the redeem activity.
async function debitPawBucksForRedemption(
  supabase: any,
  userId: string,
  merchantId: string,
  pawbucksUsed: number,
  productName: string,
  paymentIntentId: string,
) {
  if (pawbucksUsed <= 0) return;
  try {
    const { data: wallet } = await supabase
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', userId)
      .single();
    if (wallet) {
      await supabase
        .from('pawbucks_wallet')
        .update({ balance: Math.max(0, wallet.balance - pawbucksUsed) })
        .eq('user_id', userId);
    }
    await supabase.from('pawbucks_activity').insert({
      user_id: userId,
      amount: -pawbucksUsed,
      type: 'redeem',
      source: 'subscription_renewal',
      description: `Auto-redeemed ${pawbucksUsed} PawBucks on ${productName} renewal`,
      pawbucks_status: 'available',
      partner_id: merchantId,
      metadata: { payment_intent_id: paymentIntentId, auto_redeem: true },
    });
  } catch (err) {
    logStep('Error debiting PawBucks for redemption', { userId, error: String(err) });
  }
}

// Handle a renewal that is fully covered by PawBucks (no Stripe charge needed).
async function handleFullPawBucksRenewal(
  supabase: any,
  stripe: Stripe,
  subscription: SubscriptionToProcess,
  pawbucksUsed: number,
  pawbucksValueCents: number,
) {
  const now = new Date();
  const currentBilling = calculateCurrentBillingInstant(subscription);
  const nextBilling = calculateNextBillingInstant(subscription);

  await supabase.from('merchant_subscriptions').update({
    status: 'active',
    current_period_start: currentBilling.toISOString(),
    current_period_end: nextBilling.toISOString(),
    next_billing_date: nextBilling.toISOString(),
    last_payment_date: now.toISOString(),
    last_payment_status: 'succeeded_pawbucks',
    failed_payment_count: 0,
  }).eq('id', subscription.id);

  await supabase.from('merchant_subscription_events').insert({
    subscription_id: subscription.id,
    event_type: 'renewed',
    amount: subscription.amount,
    metadata: { paid_with: 'pawbucks_only', pawbucks_used: pawbucksUsed },
  });

  // Debit wallet
  await debitPawBucksForRedemption(
    supabase, subscription.user_id, subscription.merchant_id,
    pawbucksUsed, subscription.product_name, `pawbucks-only-${subscription.id}-${now.getTime()}`,
  );

  // Transaction record (no Stripe charge)
  const fullAmountDollars = subscription.amount / 100;
  await supabase.from('transactions').insert({
    user_id: subscription.user_id,
    merchant_id: subscription.merchant_id,
    amount: fullAmountDollars,
    stripe_amount: 0,
    pawbucks_used: pawbucksUsed,
    application_fee: 0,
    cashback_earned: 0,
    rewards_earned: 0,
    description: `${subscription.product_name} subscription renewal (fully paid with PawBucks)`,
    status: 'completed',
    payment_method: 'pawbucks',
  });

  await supabase.from('notifications').insert({
    user_id: subscription.user_id,
    title: 'Subscription Renewed (PawBucks)',
    message: `Your ${subscription.product_name} subscription renewed using ${pawbucksUsed.toLocaleString()} PawBucks ($${(pawbucksValueCents / 100).toFixed(2)}). No card charge.`,
    category: 'transactional',
  });

  logStep('Renewal fully covered by PawBucks', { subscriptionId: subscription.id, pawbucksUsed });
}
