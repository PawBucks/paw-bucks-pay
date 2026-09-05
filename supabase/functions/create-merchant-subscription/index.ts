import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import {
  getSpendableSources,
  planPawBucksDebit,
  applyPawBucksDebit,
} from "../_shared/pet-fund-debit.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-MERCHANT-SUBSCRIPTION] ${step}`, details ? JSON.stringify(details) : "");
};

// Helper function to send receipt email to customer
async function sendReceiptEmail(params: {
  email: string;
  customerName?: string;
  transactionDate: string;
  receiptId: string;
  merchantName: string;
  merchantLocation?: string;
  items: { name: string; price: number }[];
  subtotal: number;
  pawbucksApplied: number;
  cardAmount: number;
  totalPaid: number;
  pawbucksEarned?: number;
  tierInfo?: { tierName: string; multiplier: number };
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
        'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
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

// Helper function to send payment notification email to merchant
async function sendMerchantPaymentNotification(params: {
  merchantEmail: string;
  merchantName: string;
  customerName: string;
  customerEmail: string;
  productName: string;
  amountPaid: number;
  pawbucksUsed: number;
  paymentDate: string;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      logStep("Skipping merchant payment notification: config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice-paid-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
      },
      body: JSON.stringify({
        merchantEmail: params.merchantEmail,
        merchantName: params.merchantName,
        invoiceNumber: `SUB-${Date.now().toString(36).toUpperCase()}`,
        invoiceTitle: `${params.productName} Subscription`,
        clientName: params.customerName,
        clientEmail: params.customerEmail,
        amountPaid: params.amountPaid,
        pawbucksUsed: params.pawbucksUsed,
        paymentMethod: params.pawbucksUsed > 0 ? 'mixed' : 'credit_card',
        paymentDate: params.paymentDate,
        invoiceTotal: params.amountPaid + (params.pawbucksUsed * 0.001),
        amountDue: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send merchant payment notification:", errorText);
    } else {
      logStep(`Merchant payment notification sent to ${params.merchantEmail}`);
    }
  } catch (error) {
    console.error("Error sending merchant payment notification:", error);
  }
}

// Request validation schema
const subscriptionSchema = z.object({
  merchantId: z.string().uuid(),
  priceId: z.string().min(1), // Price ID on the connected account
  productName: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1), // Card payment method from Stripe Elements
  pawbucksToUse: z.number().int().min(0).optional(), // PawBucks to redeem
  autoRedeem: z.boolean().optional().default(false), // Honor user's auto_redeem_mode preference
  metadata: z.record(z.string()).optional(),
});

const PLATFORM_FEE_PERCENT = 0.03; // 3% platform fee
const DEFAULT_BILLING_TIMEZONE = "America/New_York";
const BILLING_LOCAL_HOUR = 12;

// PawPass product IDs for tier determination
const PAWPASS_PLUS_PRODUCT_ID = 'prod_TQyZjYzt9DwoIK';
const PAWPASS_PRODUCT_ID = 'prod_TJVK9ZhLiJnnpm';

function safeTimeZone(timeZone?: string | null): string {
  if (!timeZone) return DEFAULT_BILLING_TIMEZONE;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return DEFAULT_BILLING_TIMEZONE;
  }
}

function getLocalDateParts(date: Date, timeZone: string): Record<string, number> {
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

function formatLocalDate(date: Date, timeZone: string): string {
  const parts = getLocalDateParts(date, timeZone);
  return `${parts.year}-${String(parts.month).padStart(2, "0")}-${String(parts.day).padStart(2, "0")}`;
}

function offsetMs(date: Date, timeZone: string): number {
  const parts = getLocalDateParts(date, timeZone);
  return Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second) - date.getTime();
}

function localDateToUtc(dateString: string, timeZone: string): Date {
  const [year, month, day] = dateString.split("-").map(Number);
  const localAsUtc = Date.UTC(year, month - 1, day, BILLING_LOCAL_HOUR, 0, 0);
  let utcMs = localAsUtc;
  for (let i = 0; i < 3; i++) utcMs = localAsUtc - offsetMs(new Date(utcMs), timeZone);
  return new Date(utcMs);
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function addBillingInterval(dateString: string, interval: string, count: number): string {
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
  const next = new Date(Date.UTC(year, month - 1, day + (interval === "week" ? count * 7 : count), 12, 0, 0));
  return `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
}

// Helper function to determine user's subscription tier and multiplier
// Uses dual-verification: checks both subscription_tier field (for manual upgrades)
// and Stripe product IDs (for purchased subscriptions)
async function getUserTierMultiplier(
  supabaseAdmin: any,
  stripe: Stripe,
  userId: string
): Promise<{ multiplier: number; tierName: string }> {
  try {
    const { data: platformSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();
    const { resolveUserEarnTier } = await import("../_shared/resolve-tier.ts");
    const t = await resolveUserEarnTier(stripe, platformSub);
    logStep("User subscription tier determined", { userId, tierName: t.label, pawbucksMultiplier: t.multiplier });
    return { multiplier: t.multiplier, tierName: t.label };
  } catch (tierError) {
    logStep("Error determining tier (using default 10x)", { userId, error: String(tierError) });
    return { multiplier: 10, tierName: 'Free' };
  }
}

// Helper function to credit PawBucks to user
async function creditPawBucksToUser(
  supabaseAdmin: any,
  userId: string,
  merchantId: string,
  amountInDollars: number,
  multiplier: number,
  tierName: string,
  productName: string,
  merchantName: string,
  paymentIntentId: string
): Promise<number> {
  let pawbucksEarned = Math.floor(amountInDollars * multiplier);

  // Global kill switch: SuperAdmin can pause pet-owner PawBucks earning platform-wide
  try {
    const { isPetOwnerPawBucksEarningEnabled } = await import("../_shared/pet-owner-earning-kill-switch.ts");
    const earnEnabled = await isPetOwnerPawBucksEarningEnabled(supabaseAdmin);
    if (!earnEnabled) {
      logStep("Pet-owner PawBucks earning disabled platform-wide (subscription); overriding to 0");
      pawbucksEarned = 0;
    }
  } catch (_e) { /* default to enabled on lookup failure */ }

  if (pawbucksEarned <= 0) {
    return 0;
  }

  // === Idempotency guard: never credit the same Stripe PI twice ===
  // Defense-in-depth against duplicate function invocations, webhook races,
  // or retries. Paired with the unique partial index on pawbucks_activity
  // (user_id, stripe_payment_intent_id, type='earn') so the DB rejects
  // duplicates even if this check races.
  if (paymentIntentId) {
    const { data: existingEarn } = await supabaseAdmin
      .from("pawbucks_activity")
      .select("id, amount")
      .eq("user_id", userId)
      .eq("type", "earn")
      .eq("stripe_payment_intent_id", paymentIntentId)
      .maybeSingle();

    if (existingEarn) {
      logStep("Skipping duplicate PawBucks earn — already credited for this PaymentIntent", {
        paymentIntentId,
        existingActivityId: existingEarn.id,
        existingAmount: existingEarn.amount,
      });
      return 0;
    }
  }

  // Log activity with type 'earn'
  const { error: activityError } = await supabaseAdmin
    .from("pawbucks_activity")
    .insert({
      user_id: userId,
      amount: pawbucksEarned,
      type: "earn",
      source: "subscription_payment",
      description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${multiplier}x) from ${productName} subscription to ${merchantName}`,
      pawbucks_status: "available",
      partner_id: merchantId,
      stripe_payment_intent_id: paymentIntentId,
    });

  if (activityError) {
    // If the unique index rejected a duplicate, treat as already-credited and exit cleanly.
    if ((activityError as any).code === "23505") {
      logStep("Duplicate earn blocked by unique index — already credited", { paymentIntentId });
      return 0;
    }
    logStep("Error inserting pawbucks_activity", { error: activityError.message });
    // Do not update wallet if the ledger insert failed.
    return 0;
  } else {
    logStep("PawBucks activity logged", { amount: pawbucksEarned, type: "earn" });
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
      logStep("Error updating wallet balance", { error: walletError.message });
    } else {
      logStep("PawBucks wallet updated", { 
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
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse and validate request body
    const body = await req.json();
    const parseResult = subscriptionSchema.safeParse(body);
    if (!parseResult.success) {
      throw new Error(`Invalid request: ${parseResult.error.message}`);
    }
    const { merchantId, priceId, productName, paymentMethodId, pawbucksToUse: rawPawbucksToUse, autoRedeem, metadata } = parseResult.data;
    let pawbucksToUse = rawPawbucksToUse;
    logStep("Request validated", { merchantId, priceId, productName, pawbucksToUse, autoRedeem });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // === DUPLICATE PREVENTION: Block identical subscription purchases within 60 seconds ===
    const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();

    // Check 1: Already has an active subscription to this exact plan
    const { data: existingActiveSub } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("merchant_id", merchantId)
      .eq("stripe_price_id", priceId)
      .in("status", ["active", "trialing"])
      .maybeSingle();

    if (existingActiveSub) {
      logStep("DUPLICATE BLOCKED: User already has active subscription to this plan", {
        existingSubId: existingActiveSub.id,
        userId: user.id,
        merchantId,
        priceId,
      });
      return new Response(JSON.stringify({
        success: false,
        error: "You already have an active subscription to this plan.",
        duplicatePrevention: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }

    // Check 2: A subscription was just created in the last 60 seconds (race condition guard)
    const { data: recentSub } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("id, created_at")
      .eq("user_id", user.id)
      .eq("merchant_id", merchantId)
      .eq("stripe_price_id", priceId)
      .gte("created_at", oneMinuteAgo)
      .maybeSingle();

    if (recentSub) {
      logStep("DUPLICATE BLOCKED: Subscription created within last 60 seconds", {
        recentSubId: recentSub.id,
        createdAt: recentSub.created_at,
        userId: user.id,
      });
      return new Response(JSON.stringify({
        success: false,
        error: "This subscription was just processed. Please wait a moment before trying again.",
        duplicatePrevention: true,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 409,
      });
    }

    logStep("Duplicate check passed");

    // Get merchant details including Stripe Connect account
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, stripe_account_id, onboarding_complete, user_id, address, timezone")
      .eq("id", merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    if (!merchant.stripe_account_id) {
      throw new Error("Merchant has not connected their Stripe account");
    }

    const connectedAccountId = merchant.stripe_account_id;
    logStep("Merchant found", { merchantId: merchant.id, connectedAccountId });

    // SAFETY CHECK: Verify connected account is still active and can accept charges
    logStep("Verifying connected account status...");
    const account = await stripe.accounts.retrieve(connectedAccountId);
    
    if (!account.charges_enabled) {
      logStep("Connected account cannot accept charges", { 
        chargesEnabled: account.charges_enabled,
        requirements: account.requirements?.currently_due 
      });
      
      // Update merchant status in our database
      await supabaseAdmin
        .from("merchants")
        .update({ onboarding_complete: false, stripe_account_status: "restricted" })
        .eq("id", merchantId);
      
      throw new Error("Merchant's payment account is not active. They may need to complete verification.");
    }
    logStep("Connected account verified", { 
      chargesEnabled: account.charges_enabled, 
      payoutsEnabled: account.payouts_enabled 
    });

    // Get price details from the connected account
    const price = await stripe.prices.retrieve(priceId, {}, { stripeAccount: connectedAccountId });
    
    if (!price.active) {
      throw new Error("This subscription plan is no longer available");
    }
    
    const amount = price.unit_amount || 0;
    const currency = price.currency;
    const interval = price.recurring?.interval || "month";
    const intervalCount = price.recurring?.interval_count || 1;
    
    logStep("Price retrieved from connected account", { 
      priceId, 
      amount, 
      currency, 
      interval, 
      intervalCount 
    });

    // Create or retrieve customer ON THE CONNECTED ACCOUNT (not platform)
    let connectedCustomer: Stripe.Customer;
    
    // Search for existing customer on connected account by email
    const existingCustomers = await stripe.customers.list(
      { email: user.email, limit: 1 },
      { stripeAccount: connectedAccountId }
    );

    if (existingCustomers.data.length > 0) {
      connectedCustomer = existingCustomers.data[0];
      logStep("Existing customer found on connected account", { customerId: connectedCustomer.id });
    } else {
      // Create new customer on connected account
      connectedCustomer = await stripe.customers.create(
        {
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
          metadata: {
            platform_user_id: user.id,
            source: "pawbucks_platform",
          },
        },
        { stripeAccount: connectedAccountId }
      );
      logStep("New customer created on connected account", { customerId: connectedCustomer.id });
    }

    // Attach payment method to customer on connected account
    await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: connectedCustomer.id },
      { stripeAccount: connectedAccountId }
    );

    // Set as default payment method
    await stripe.customers.update(
      connectedCustomer.id,
      { invoice_settings: { default_payment_method: paymentMethodId } },
      { stripeAccount: connectedAccountId }
    );
    logStep("Payment method attached to connected customer", { paymentMethodId });

    // Calculate billing dates on the merchant's local calendar day, not UTC.
    const now = new Date();
    const billingTimeZone = safeTimeZone(merchant.timezone);
    const startLocalDate = formatLocalDate(now, billingTimeZone);
    const periodEndLocalDate = addBillingInterval(startLocalDate, interval, intervalCount);
    const periodStart = localDateToUtc(startLocalDate, billingTimeZone);
    const periodEnd = localDateToUtc(periodEndLocalDate, billingTimeZone);

    // === PAWBUCKS REDEMPTION LOGIC ===
    const PAWBUCKS_TO_USD = 0.001; // 1000 PawBucks = $1.00
    const MINIMUM_STRIPE_CENTS = 50; // $0.50 minimum for subscriptions
    
    let actualPawbucksUsed = 0;
    let pawbucksDiscountCents = 0;
    let stripeChargeAmount = amount;
    let autoRedeemApplied = false;

    // === AUTO-REDEEM FALLBACK ===
    // If the client did not pre-compute pawbucksToUse and the user has auto-redeem on,
    // compute the redemption amount server-side from their saved preferences.
    if ((!pawbucksToUse || pawbucksToUse <= 0) && autoRedeem) {
      const { data: arProfile } = await supabaseAdmin
        .from('profiles')
        .select('auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct')
        .eq('id', user.id)
        .single();

      const arMode = (arProfile?.auto_redeem_mode as string) || 'off';
      const minCoveragePct = arProfile?.auto_redeem_min_coverage_pct ?? 20;
      const maxApplyPct = arProfile?.auto_redeem_max_apply_pct ?? 50;

      logStep("Auto-redeem evaluation (merchant subscription)", { arMode, minCoveragePct, maxApplyPct });

      // Merchant subscriptions are recurring, so all four "on" modes apply
      // (off | subscriptions_only | smart | always).
      if (arMode === 'subscriptions_only' || arMode === 'always' || arMode === 'smart') {
        // Confirm merchant accepts PawBucks
        const { data: merchantCheck } = await supabaseAdmin
          .from('merchants')
          .select('accepts_pawbucks')
          .eq('id', merchantId)
          .single();

        if (merchantCheck?.accepts_pawbucks) {
          const priceUsd = amount / 100;
          // Spendable = wallet + Pet Fund welcome credit (if txn meets its minimum) + legacy credit
          const sources = await getSpendableSources(supabaseAdmin, user.id);
          const petFundEligible =
            sources.petFundAvailable > 0 &&
            (!sources.petFundMinUsd || priceUsd >= sources.petFundMinUsd);
          const legacyEligible =
            sources.legacyCreditBalance > 0 &&
            (!sources.legacyCreditMinUsd || priceUsd >= sources.legacyCreditMinUsd);
          const availablePB =
            sources.walletBalance +
            (petFundEligible ? sources.petFundAvailable : 0) +
            (legacyEligible ? sources.legacyCreditBalance : 0);

          logStep("Spendable sources (merchant subscription)", {
            wallet: sources.walletBalance,
            petFundAvailable: sources.petFundAvailable,
            petFundMinUsd: sources.petFundMinUsd,
            petFundEligible,
            legacyEligible,
            availablePB,
          });

          if (availablePB > 0 && priceUsd > 0) {
            const maxPbBySubFloor = Math.max(
              0,
              Math.floor((amount - MINIMUM_STRIPE_CENTS) / 100 / PAWBUCKS_TO_USD),
            );
            let proposedPb = 0;

            if (arMode === 'always' || arMode === 'subscriptions_only') {
              proposedPb = Math.min(availablePB, maxPbBySubFloor);
            } else if (arMode === 'smart') {
              const availableUsd = availablePB * PAWBUCKS_TO_USD;
              const coveragePct = (availableUsd / priceUsd) * 100;
              if (coveragePct >= minCoveragePct) {
                const maxUsd = priceUsd * (maxApplyPct / 100);
                proposedPb = Math.min(
                  availablePB,
                  Math.floor(maxUsd / PAWBUCKS_TO_USD),
                  maxPbBySubFloor,
                );
              }
            }

            if (proposedPb > 0) {
              pawbucksToUse = proposedPb;
              autoRedeemApplied = true;
              logStep("Auto-redeem applied to merchant subscription", {
                pawbucksToUse,
                arMode,
                availablePB,
                priceUsd,
              });
            } else {
              logStep("Auto-redeem skipped (proposed amount = 0)", { arMode, availablePB, priceUsd });
            }
          }
        } else {
          logStep("Auto-redeem skipped: merchant does not accept PawBucks");
        }
      }
    }

    if (pawbucksToUse && pawbucksToUse > 0) {
      // Validate against all spendable sources: wallet + Pet Fund credit + legacy credit
      const priceUsdForCheck = amount / 100;
      const checkSources = await getSpendableSources(supabaseAdmin, user.id);
      const petFundEligibleForCheck =
        checkSources.petFundAvailable > 0 &&
        (!checkSources.petFundMinUsd || priceUsdForCheck >= checkSources.petFundMinUsd);
      const legacyEligibleForCheck =
        checkSources.legacyCreditBalance > 0 &&
        (!checkSources.legacyCreditMinUsd || priceUsdForCheck >= checkSources.legacyCreditMinUsd);
      const availableBalance =
        checkSources.walletBalance +
        (petFundEligibleForCheck ? checkSources.petFundAvailable : 0) +
        (legacyEligibleForCheck ? checkSources.legacyCreditBalance : 0);

      if (pawbucksToUse > availableBalance) {
        throw new Error(`Insufficient PawBucks balance. You have ${availableBalance} eligible but tried to use ${pawbucksToUse}.`);
      }

      // Check merchant accepts PawBucks
      const { data: merchantCheck } = await supabaseAdmin
        .from('merchants')
        .select('accepts_pawbucks')
        .eq('id', merchantId)
        .single();

      if (!merchantCheck?.accepts_pawbucks) {
        throw new Error("This merchant does not accept PawBucks.");
      }

      // Calculate discount (ensure minimum Stripe charge)
      const maxPawbucksDiscountCents = amount - MINIMUM_STRIPE_CENTS;
      const requestedDiscountCents = Math.round(pawbucksToUse * PAWBUCKS_TO_USD * 100);
      pawbucksDiscountCents = Math.min(requestedDiscountCents, maxPawbucksDiscountCents);
      
      // Recalculate actual PawBucks used based on capped discount
      actualPawbucksUsed = Math.floor(pawbucksDiscountCents / PAWBUCKS_TO_USD / 100);
      stripeChargeAmount = amount - pawbucksDiscountCents;

      logStep("PawBucks redemption calculated", {
        requested: pawbucksToUse,
        actualUsed: actualPawbucksUsed,
        discountCents: pawbucksDiscountCents,
        stripeChargeAmount,
      });
    }

    // Calculate application fee (3% platform fee on Stripe portion only)
    const applicationFee = Math.round(stripeChargeAmount * PLATFORM_FEE_PERCENT);
    
    logStep("Creating initial payment", { 
      originalAmount: amount,
      pawbucksDiscount: pawbucksDiscountCents,
      stripeChargeAmount, 
      applicationFee,
      merchantReceives: stripeChargeAmount - applicationFee 
    });

    // Create the first PaymentIntent on the connected account (Direct Charge)
    // Use payment_method_types instead of automatic_payment_methods to avoid redirect requirements
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: stripeChargeAmount,
        currency,
        customer: connectedCustomer.id,
        payment_method: paymentMethodId,
        payment_method_types: ['card'], // Explicitly only allow card payments (no redirects)
        off_session: false, // First payment is on-session
        confirm: true,
        application_fee_amount: applicationFee,
        description: `${productName} subscription - First payment${actualPawbucksUsed > 0 ? ` (${actualPawbucksUsed} PawBucks applied)` : ''}`,
        metadata: {
          merchant_id: merchantId,
          user_id: user.id,
          business_name: merchant.business_name, // Include for receipt emails
          subscription_type: "merchant_recurring",
          product_name: productName,
          billing_interval: interval,
          platform: "pawbucks",
          pawbucks_used: actualPawbucksUsed.toString(),
          original_amount: amount.toString(),
          description: `${productName} subscription to ${merchant.business_name}`,
          ...metadata,
        },
      },
      { stripeAccount: connectedAccountId }
    );

    logStep("Initial PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status 
    });

    // Check if payment succeeded
    if (paymentIntent.status !== "succeeded") {
      // Payment requires action or failed
      if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
        return new Response(JSON.stringify({
          success: false,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          connectedAccountId,
          message: "Payment requires additional authentication",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }

    // Payment succeeded - create subscription record
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .insert({
        user_id: user.id,
        stripe_customer_id_on_connected: connectedCustomer.id,
        merchant_id: merchantId,
        connected_account_id: connectedAccountId,
        stripe_price_id: priceId,
        product_name: productName,
        amount,
        currency,
        billing_interval: interval,
        billing_interval_count: intervalCount,
        status: "active",
        current_period_start: periodStart.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_billing_date: periodEnd.toISOString(),
        last_payment_date: now.toISOString(),
        last_payment_intent_id: paymentIntent.id,
        last_payment_status: "succeeded",
        application_fee_percent: PLATFORM_FEE_PERCENT * 100,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (subError) {
      logStep("Error creating subscription record", { error: subError.message });
      throw new Error("Failed to create subscription record");
    }

    logStep("Subscription created", { subscriptionId: subscription.id });

    // === CRITICAL: Insert transactions row keyed by stripe_payment_intent_id ===
    // This is the definitive duplicate-guard for connect-webhook / stripe-webhook.
    // If we skip this, those webhooks fall through their metadata guard on any
    // race/replay/redeploy and create a second (PAY-xxx) "Payment Received"
    // email plus a duplicate PawBucks earn row for the same charge.
    const stripeAmountInDollarsForTx = stripeChargeAmount / 100;
    const platformFeeUsd = (applicationFee || 0) / 100;
    const { error: txInsertErr } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: user.id,
        merchant_id: merchantId,
        amount: amount / 100,
        stripe_amount: stripeAmountInDollarsForTx,
        pawbucks_used: actualPawbucksUsed,
        application_fee: platformFeeUsd,
        status: "completed",
        rewards_earned: 0, // filled in below once tier is resolved
        cashback_earned: 0,
        stripe_payment_intent_id: paymentIntent.id,
        description: `${productName} subscription to ${merchant.business_name}`,
      });
    if (txInsertErr && (txInsertErr as any).code !== "23505") {
      logStep("WARN: failed to insert transactions row for subscription", { error: txInsertErr.message });
    } else {
      logStep("Transactions row inserted for subscription (idempotency guard)");
    }

    // Log subscription event
    await supabaseAdmin.from("merchant_subscription_events").insert({
      subscription_id: subscription.id,
      event_type: "created",
      amount,
      payment_intent_id: paymentIntent.id,
      metadata: {
        product_name: productName,
        billing_interval: interval,
        merchant_name: merchant.business_name,
      },
    });

    // === PAWBUCKS REDEMPTION - DEDUCT FROM USER & CREDIT TO MERCHANT ===
    if (actualPawbucksUsed > 0) {
      // Debit across wallet → Pet Fund welcome credit → legacy welcome credit
      const debitSources = await getSpendableSources(supabaseAdmin, user.id);
      const debitPlan = planPawBucksDebit(debitSources, actualPawbucksUsed, amount / 100);
      await applyPawBucksDebit(supabaseAdmin, user.id, debitPlan, {
        merchantId,
        transactionTotalCents: amount,
      });

      // Log debit activity
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: user.id,
        amount: actualPawbucksUsed,
        type: 'redeem',
        source: 'subscription_payment',
        description: `Redeemed ${actualPawbucksUsed} PawBucks for ${productName} subscription at ${merchant.business_name}`,
        pawbucks_status: 'available',
        partner_id: merchantId,
      });

      logStep("PawBucks deducted from user", {
        deducted: actualPawbucksUsed,
        wallet: debitPlan.walletDeduction,
        petFund: debitPlan.petFundDeduction,
        legacyCredit: debitPlan.legacyCreditDeduction,
      });

      // Credit PawBucks to merchant's wallet
      const { data: merchantWallet } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchantId)
        .single();

      const merchantCurrentBalance = merchantWallet?.balance || 0;
      const merchantNewBalance = merchantCurrentBalance + actualPawbucksUsed;

      if (merchantWallet) {
        await supabaseAdmin
          .from('merchant_pawbucks_wallet')
          .update({ balance: merchantNewBalance })
          .eq('merchant_id', merchantId);
      } else {
        await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
          merchant_id: merchantId,
          balance: actualPawbucksUsed,
        });
      }

      // Log merchant credit activity
      await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchantId,
        type: 'earn',
        amount: actualPawbucksUsed,
        source: 'Customer Redemption',
        customer_user_id: user.id,
        description: `Customer redeemed ${actualPawbucksUsed} PawBucks for subscription`,
      });

      logStep("PawBucks credited to merchant", { 
        previousBalance: merchantCurrentBalance, 
        credited: actualPawbucksUsed, 
        newBalance: merchantNewBalance 
      });
    }

    // === PAWBUCKS REWARDS PROCESSING (based on Stripe amount only) ===
    const stripeAmountInDollars = stripeChargeAmount / 100;

    // Get user's subscription tier for multiplier
    const { multiplier, tierName } = await getUserTierMultiplier(supabaseAdmin, stripe, user.id);

    // Credit PawBucks to user (rewards based on Stripe portion only)
    const pawbucksEarned = await creditPawBucksToUser(
      supabaseAdmin,
      user.id,
      merchantId,
      stripeAmountInDollars,
      multiplier,
      tierName,
      productName,
      merchant.business_name,
      paymentIntent.id
    );

    // Update transactions row with rewards_earned (best-effort)
    if (pawbucksEarned > 0) {
      await supabaseAdmin
        .from("transactions")
        .update({ rewards_earned: pawbucksEarned, cashback_earned: pawbucksEarned })
        .eq("stripe_payment_intent_id", paymentIntent.id);
    }

    // Auto-log success fee as Tax Vault expense
    if (applicationFee > 0) {
      const expenseDate = new Date().toISOString().split('T')[0];
      const taxYear = new Date().getFullYear();

      await supabaseAdmin
        .from("merchant_tax_expenses")
        .insert({
          merchant_id: merchantId,
          category: "platform_fees",
          amount: applicationFee / 100, // Convert to dollars
          description: `PawBucks Success Fee (3%) on $${stripeAmountInDollars.toFixed(2)} subscription payment`,
          vendor_name: "PawBucks Network",
          expense_date: expenseDate,
          tax_year: taxYear,
          is_auto_logged: true,
          source_purchase_id: paymentIntent.id,
        });

      logStep("Success fee auto-logged to Tax Vault");
    }

    // Send notification to user
    const pawbucksUsedMsg = actualPawbucksUsed > 0 ? ` Used ${actualPawbucksUsed} PawBucks for $${(pawbucksDiscountCents / 100).toFixed(2)} off.` : '';
    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Subscription Started",
      message: `Your subscription to ${productName} from ${merchant.business_name} is now active.${pawbucksUsedMsg} You earned ${pawbucksEarned} PawBucks!`,
      category: "transactional",
    });

    // Send receipt email to customer
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    const customerEmail = userProfile?.email || user.email;
    const amountInDollars = amount / 100;
    if (customerEmail) {
      const { multiplier: tierMultiplier, tierName: userTierName } = await getUserTierMultiplier(supabaseAdmin, stripe, user.id);
      
      await sendReceiptEmail({
        email: customerEmail,
        customerName: userProfile?.full_name || undefined,
        transactionDate: new Date().toISOString(),
        receiptId: subscription.id,
        merchantName: merchant.business_name,
        merchantLocation: merchant.address || undefined,
        items: [{ name: `${productName} Subscription`, price: amountInDollars }],
        subtotal: amountInDollars,
        pawbucksApplied: actualPawbucksUsed,
        cardAmount: stripeChargeAmount / 100,
        totalPaid: amountInDollars,
        pawbucksEarned,
        tierInfo: {
          tierName: userTierName,
          multiplier: tierMultiplier,
        },
      });
    }

    // Send in-app notification to merchant
    await supabaseAdmin.from("notifications").insert({
      user_id: merchant.user_id,
      title: "💰 New Payment Received",
      message: `${userProfile?.full_name || 'A customer'} subscribed to ${productName} for $${amountInDollars.toFixed(2)}.`,
      category: "transactional",
    });

    // Send payment received email notification to merchant
    const { data: merchantProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', merchant.user_id)
      .single();

    if (merchantProfile?.email) {
      await sendMerchantPaymentNotification({
        merchantEmail: merchantProfile.email,
        merchantName: merchant.business_name || merchantProfile.full_name || 'Merchant',
        customerName: userProfile?.full_name || 'Customer',
        customerEmail: customerEmail || '',
        productName,
        amountPaid: amountInDollars,
        pawbucksUsed: actualPawbucksUsed,
        paymentDate: new Date().toISOString(),
      });
    }

    return new Response(JSON.stringify({
      success: true,
      subscriptionId: subscription.id,
      status: "active",
      nextBillingDate: periodEnd.toISOString(),
      amount: amount / 100, // Return original amount in dollars
      stripeAmount: stripeChargeAmount / 100,
      productName,
      merchantName: merchant.business_name,
      pawbucksEarned,
      pawbucksUsed: actualPawbucksUsed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
