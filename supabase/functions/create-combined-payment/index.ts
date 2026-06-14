import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.22.4";
import {
  effectivePawBucksCapPct,
  clampManualPawBucks,
  clampAutoRedeemPawBucks,
} from "../_shared/pawbucks-cap.ts";
import {
  getSpendableSources,
  planPawBucksDebit,
  applyPawBucksDebit,
} from "../_shared/pet-fund-debit.ts";
import {
  insertTransactionItems,
  itemsToReceiptItems,
  type IncomingTransactionItem,
} from "../_shared/transaction-items.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Validation schema for combined payment
const itemSchema = z.object({
  source_type: z.enum(["catalog_item", "pet_store_item", "merchant_service", "custom"]),
  source_id: z.string().uuid().nullable().optional(),
  name: z.string().trim().min(1).max(200),
  description: z.string().max(1000).nullable().optional(),
  sku: z.string().max(80).nullable().optional(),
  quantity: z.number().positive(),
  unit_price: z.number().min(0),
  image_url: z.string().url().nullable().optional(),
});

const combinedPaymentSchema = z.object({
  totalAmount: z.number().positive({ message: "Amount must be greater than 0" }),
  pawbucksAmount: z.number().min(0).default(0),
  storeLockedPawbucks: z.number().min(0).default(0), // PB redeemed from this merchant's store-locked balance
  tipAmount: z.number().min(0).default(0), // Tip in USD, always charged to card
  merchantId: z.string().uuid({ message: "Invalid merchant ID" }),
  description: z.string().max(500).optional(),
  autoRedeem: z.boolean().optional().default(false),
  items: z.array(itemSchema).max(100).optional(),
});

// PawBucks conversion for pet owners: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
const PLATFORM_FEE_PERCENT = 0.03; // 3% platform fee

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-COMBINED-PAYMENT] ${step}`, details ? JSON.stringify(details) : "");
};

// Helper function to send receipt email
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
  cardBrand?: string;
  cardLast4?: string;
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    logStep("User authenticated", { userId: user.id });

    const requestBody = await req.json();
    const validation = combinedPaymentSchema.safeParse(requestBody);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { totalAmount, pawbucksAmount: manualPawbucksAmount, storeLockedPawbucks, tipAmount, merchantId, description, autoRedeem: requestAutoRedeem, items } = validation.data;
    const lineItems: IncomingTransactionItem[] = items ?? [];

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolve effective wallet user (shared accounts). PawBucks, Pet Fund,
    // and Welcome Credits all live on the primary owner's record — if the
    // paying user is a shared-account member we must read/debit from the
    // owner, otherwise we falsely report "Insufficient PawBucks balance".
    const { data: sharedMembership } = await supabaseAdmin
      .from('shared_account_members')
      .select('account_id, shared_accounts!inner(owner_id)')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle();
    const effectiveUserId = (sharedMembership as any)?.shared_accounts?.owner_id || user.id;
    logStep('Effective wallet user resolved', { paying: user.id, effective: effectiveUserId });

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id, cashback_rate, business_name, accepts_pawbucks, onboarding_complete, address, business_type, pawbucks_cap_enabled, pawbucks_cap_pct, pawbucks_promo_cap_pct, pawbucks_promo_starts_at, pawbucks_promo_ends_at')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    // Validate PawBucks usage
    if (manualPawbucksAmount > 0 && !merchant.accepts_pawbucks) {
      throw new Error('This merchant does not accept PawBucks');
    }

    // --- Merchant PawBucks Acceptance Cap ---
    // Compute the effective cap right now. null = no cap.
    const effectiveCapPct = effectivePawBucksCapPct(merchant);

    // --- Auto-Redeem Logic ---
    let pawbucksAmount = manualPawbucksAmount;
    const baseAmount = totalAmount - tipAmount; // Base amount excluding tip
    const spendableSources = await getSpendableSources(supabaseAdmin, effectiveUserId);
    const petFundEligibleForBase =
      spendableSources.petFundAvailable > 0 &&
      (!spendableSources.petFundMinUsd || baseAmount >= spendableSources.petFundMinUsd);
    const eligiblePawBucksTotal =
      spendableSources.walletBalance +
      (petFundEligibleForBase ? spendableSources.petFundAvailable : 0) +
      spendableSources.legacyCreditBalance;

    // Apply cap to manual redemption requests up-front
    if (effectiveCapPct !== null && pawbucksAmount > 0 && baseAmount > 0) {
      const clamped = clampManualPawBucks(pawbucksAmount, baseAmount, merchant);
      if (clamped < pawbucksAmount) {
        logStep('Manual PawBucks clamped to merchant cap', {
          requested: pawbucksAmount,
          capPct: effectiveCapPct,
          maxPbAllowed: clamped,
        });
        pawbucksAmount = clamped;
      }
    }

    if (requestAutoRedeem && pawbucksAmount === 0 && merchant.accepts_pawbucks && baseAmount > 0) {
      // Fetch user's auto-redeem preferences
      const { data: arProfile } = await supabaseAdmin
        .from('profiles')
        .select('auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct')
        .eq('id', user.id)
        .single();

      // For the simplified pet-owner flow, savings are ALWAYS auto-applied
      // when the client requests it. Treat missing/off profile setting as 'always'.
      const autoRedeemMode = arProfile?.auto_redeem_mode && arProfile.auto_redeem_mode !== 'off'
        ? arProfile.auto_redeem_mode
        : 'always';
      const minCoveragePct = arProfile?.auto_redeem_min_coverage_pct ?? 20;
      const maxApplyPct = arProfile?.auto_redeem_max_apply_pct ?? 50;

      const arAvailable = eligiblePawBucksTotal;

      logStep('Auto-redeem check (combined)', { autoRedeemMode, minCoveragePct, maxApplyPct, arAvailable, baseAmount });

      if (arAvailable > 0) {
        let shouldAutoRedeem = false;
        let maxPBToApply = arAvailable;

        if (autoRedeemMode === 'always') {
          shouldAutoRedeem = true;
        } else if (autoRedeemMode === 'smart') {
          const availableUsd = arAvailable * PAWBUCKS_TO_USD;
          const coveragePct = (availableUsd / baseAmount) * 100;
          if (coveragePct >= minCoveragePct) {
            shouldAutoRedeem = true;
            const maxUsd = baseAmount * (maxApplyPct / 100);
            maxPBToApply = Math.min(arAvailable, Math.floor(maxUsd / PAWBUCKS_TO_USD));
          }
          logStep('Smart auto-redeem eval (combined)', { coveragePct: coveragePct.toFixed(1), shouldAutoRedeem });
        }
        // subscriptions_only: not applicable for merchant payments

        if (shouldAutoRedeem && maxPBToApply > 0) {
          // Clamp to subtotal AND to merchant cap (single source of truth).
          const before = maxPBToApply;
          maxPBToApply = clampAutoRedeemPawBucks(maxPBToApply, baseAmount, merchant);
          if (maxPBToApply < before) {
            logStep('Auto-redeem clamped (subtotal/cap)', {
              before, after: maxPBToApply, capPct: effectiveCapPct,
            });
          }
          const autoUsd = maxPBToApply * PAWBUCKS_TO_USD;
          pawbucksAmount = maxPBToApply;
          logStep('Auto-redeem applied (combined)', { pawbucksAmount, usdValue: autoUsd.toFixed(2) });
        }
      }
    }

    // Store-locked PawBucks: VALIDATE balance now (no debit yet).
    // These merchant-specific PB are issued via Store Rewards Pro and apply only
    // at the issuing merchant. We must NOT debit them until Stripe confirms the
    // payment (or, in the PawBucks-only branch, when we finalize the transaction).
    if (storeLockedPawbucks > 0) {
      const { data: slpbRow, error: slpbErr } = await supabaseAdmin
        .from('store_locked_pawbucks')
        .select('balance')
        .eq('user_id', user.id)
        .eq('merchant_id', merchantId)
        .maybeSingle();
      if (slpbErr) {
        throw new Error('Could not verify in-store PawBucks balance');
      }
      const slpbBalance = Number(slpbRow?.balance || 0);
      if (slpbBalance < storeLockedPawbucks) {
        return new Response(
          JSON.stringify({ error: `Insufficient in-store PawBucks. Available: ${slpbBalance}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
      logStep('Store-locked PawBucks validated (debit deferred until Stripe success)', {
        storeLockedPawbucks, slpbBalance,
      });
    }

    // Calculate USD value of PawBucks - both regular and store-locked apply to base amount ONLY, not tip
    const storeLockedUsdValue = storeLockedPawbucks * PAWBUCKS_TO_USD;
    const pawbucksUsdValue = pawbucksAmount * PAWBUCKS_TO_USD;
    const totalPbUsdValue = pawbucksUsdValue + storeLockedUsdValue;
    const stripeAmount = Math.max(0, baseAmount - totalPbUsdValue) + tipAmount; // Tip always goes to card

    // Determine how much comes from wallet vs welcome credit
    let walletPawbucks = 0;
    let welcomeCreditPawbucks = 0;
    let debitPlan: ReturnType<typeof planPawBucksDebit> | null = null;

    if (pawbucksAmount > 0) {
      debitPlan = planPawBucksDebit(spendableSources, pawbucksAmount, baseAmount);
      walletPawbucks = debitPlan.walletDeduction;
      welcomeCreditPawbucks = debitPlan.petFundDeduction + debitPlan.legacyCreditDeduction;
    }

    logStep('Payment breakdown', {
      totalAmount,
      baseAmount,
      tipAmount,
      pawbucksAmount,
      walletPawbucks,
      welcomeCreditPawbucks,
      pawbucksUsdValue,
      stripeAmount,
      merchantAcceptsPawbucks: merchant.accepts_pawbucks,
    });

    // CASE 1: Full PawBucks payment (no Stripe needed)
    if (stripeAmount <= 0) {
      logStep("Processing full PawBucks payment");

      // Debit store-locked PawBucks now (no Stripe step in this branch).
      if (storeLockedPawbucks > 0) {
        const { data: slpbRedeem, error: slpbRedeemErr } = await supabaseAdmin.rpc(
          'redeem_store_locked_pawbucks',
          {
            p_merchant_id: merchantId,
            p_user_id: user.id,
            p_amount_pb: storeLockedPawbucks,
            p_transaction_id: null,
            p_description: `In-store PawBucks redemption at ${merchant.business_name}`,
          }
        );
        if (slpbRedeemErr || !(slpbRedeem as any)?.success) {
          const msg = (slpbRedeem as any)?.error || slpbRedeemErr?.message || 'Could not redeem in-store PawBucks';
          return new Response(
            JSON.stringify({ error: msg }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        logStep('Store-locked PawBucks redeemed (full-PB branch)', { storeLockedPawbucks });
      }

      // ============================================================
      // IDEMPOTENCY CHECK: Prevent duplicate PawBucks-only transactions
      // If same user+merchant+amount within last 60 seconds, reject as duplicate
      // ============================================================
      const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
      const { data: recentDuplicate } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('user_id', user.id)
        .eq('merchant_id', merchantId)
        .eq('amount', totalAmount)
        .eq('stripe_amount', 0)
        .eq('status', 'completed')
        .gte('created_at', sixtySecondsAgo)
        .limit(1)
        .maybeSingle();

      if (recentDuplicate) {
        logStep("Duplicate PawBucks payment detected, returning existing transaction", { existingId: recentDuplicate.id });
        return new Response(
          JSON.stringify({
            success: true,
            paymentMethod: 'pawbucks_only',
            pawbucksUsed: pawbucksAmount,
            transactionId: recentDuplicate.id,
            duplicate: true,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }

      const fullDebitPlan = debitPlan ?? planPawBucksDebit(spendableSources, pawbucksAmount, baseAmount);
      await applyPawBucksDebit(supabaseAdmin, effectiveUserId, fullDebitPlan, {
        merchantId,
        transactionTotalCents: Math.round(baseAmount * 100),
      });
      const actualWalletPawbucks = fullDebitPlan.walletDeduction;
      logStep("PawBucks debited from canonical sources (PawBucks-only)", fullDebitPlan);

      // Credit merchant's PawBucks wallet
      const { data: merchantWallet } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchantId)
        .single();

      if (merchantWallet) {
        await supabaseAdmin
          .from('merchant_pawbucks_wallet')
          .update({ balance: merchantWallet.balance + pawbucksAmount })
          .eq('merchant_id', merchantId);
      } else {
        await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
          merchant_id: merchantId,
          balance: pawbucksAmount,
        });
      }

      // Log merchant PawBucks activity
      await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchantId,
        type: 'earn',
        amount: pawbucksAmount,
        source: 'Customer Payment',
        customer_user_id: user.id,
        description: `Received ${pawbucksAmount} PawBucks from customer`,
      });

      // Create transaction record - NO platform fee on PawBucks-only payments
      const { data: transaction } = await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        merchant_id: merchantId,
        amount: totalAmount,
        stripe_amount: 0,
        pawbucks_used: pawbucksAmount,
        application_fee: 0, // No fee on PawBucks payments
        cashback_earned: 0, // No cashback on PawBucks payments
        rewards_earned: 0,
        description: description || `PawBucks payment to ${merchant.business_name}`,
        status: 'completed',
      }).select().single();

      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: effectiveUserId,
        amount: pawbucksAmount,
        type: 'redeem',
        source: 'merchant_payment',
        description: `Payment to ${merchant.business_name}`,
        partner_id: merchantId,
        transaction_id: transaction?.id || null,
      });

      // Persist line items (best-effort; non-fatal)
      if (transaction?.id && lineItems.length > 0) {
        await insertTransactionItems(supabaseAdmin, {
          transactionId: transaction.id,
          merchantId,
          items: lineItems,
        });
      }

      // Track Branded PawBucks redemption (FIFO across active campaigns at this merchant)
      if (actualWalletPawbucks > 0 && transaction?.id) {
        try {
          // No line-item context for generic merchant payments → empty cart.
          const { error: brandedRedeemErr } = await supabaseAdmin.rpc(
            "redeem_branded_pawbucks_v2",
            {
              p_user_id: user.id,
              p_merchant_id: merchantId,
              p_amount: actualWalletPawbucks,
              p_line_items: [],
              p_transaction_id: transaction.id,
              p_description: `Branded PawBucks redeemed at ${merchant.business_name}`,
            },
          );
          if (brandedRedeemErr) {
            logStep("Branded PawBucks redemption tracking failed (non-fatal)", { error: brandedRedeemErr.message });
          }
        } catch (e) {
          logStep("Branded PawBucks redemption tracking exception (non-fatal)", { error: (e as Error).message });
        }
      }

      // Get user profile for receipt email
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      // Send receipt email for full PawBucks payment
      const customerEmail = userProfile?.email || user.email;
      if (customerEmail) {
        await sendReceiptEmail({
          email: customerEmail,
          customerName: userProfile?.full_name || undefined,
          transactionDate: new Date().toISOString(),
          receiptId: transaction?.id || `PB-${Date.now()}`,
          merchantName: merchant.business_name,
          merchantLocation: merchant.address || undefined,
          items: lineItems.length > 0
            ? itemsToReceiptItems(lineItems)
            : [{ name: description || 'PawBucks Payment', price: totalAmount }],
          subtotal: totalAmount,
          pawbucksApplied: pawbucksUsdValue,
          cardAmount: 0,
          totalPaid: totalAmount,
          pawbucksEarned: 0,
        });
      }

      // Handle referrer bonus activation on first purchase
      try {
        const { count: completedTxCount } = await supabaseAdmin
          .from('transactions')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('status', 'completed');

        if (completedTxCount === 1 && totalAmount >= 40) {
          const { data: pendingBonus } = await supabaseAdmin
            .from('pet_fund_referrer_bonuses')
            .select('id, referrer_id')
            .eq('referee_id', user.id)
            .eq('status', 'pending')
            .maybeSingle();

          if (pendingBonus) {
            const { data: month2Release } = await supabaseAdmin
              .from('pet_fund_releases')
              .select('scheduled_at')
              .eq('user_id', user.id)
              .eq('month_number', 2)
              .maybeSingle();

            const releaseAt = month2Release?.scheduled_at || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

            await supabaseAdmin
              .from('pet_fund_referrer_bonuses')
              .update({ status: 'locked', release_at: releaseAt })
              .eq('id', pendingBonus.id);

            await supabaseAdmin.from('notifications').insert({
              user_id: pendingBonus.referrer_id,
              title: '🎉 Referral Bonus Earned!',
              message: `Your friend made their first purchase! You've earned 10,000 PawBucks ($10) that will unlock soon.`,
              category: 'promotional',
            });

            logStep("Referrer bonus activated", { bonusId: pendingBonus.id, referrerId: pendingBonus.referrer_id });
          }
        }
      } catch (refErr) {
        logStep("Error processing referrer bonus", { error: String(refErr) });
      }

      logStep("Full PawBucks payment completed", { transactionId: transaction?.id });

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'pawbucks_only',
          pawbucksUsed: pawbucksAmount,
          transactionId: transaction?.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CASE 2 & 3: Stripe payment (full or partial with PawBucks)
    if (!merchant.stripe_account_id) {
      throw new Error('This merchant has not set up payment processing yet. Please contact the business directly.');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    // Verify the connected account can actually accept payments
    try {
      const connectedAccount = await stripe.accounts.retrieve(merchant.stripe_account_id);
      logStep('Connected account status', {
        accountId: merchant.stripe_account_id,
        chargesEnabled: connectedAccount.charges_enabled,
        payoutsEnabled: connectedAccount.payouts_enabled,
        detailsSubmitted: connectedAccount.details_submitted,
      });

      if (!connectedAccount.charges_enabled) {
        // Update the merchant's onboarding status in our database
        await supabaseAdmin
          .from('merchants')
          .update({ onboarding_complete: false })
          .eq('id', merchantId);

        throw new Error(`${merchant.business_name} hasn't completed their payment setup yet. Please ask them to complete onboarding in their Merchant Dashboard.`);
      }

      // Sync our database if Stripe says charges are enabled
      if (!merchant.onboarding_complete && connectedAccount.charges_enabled) {
        await supabaseAdmin
          .from('merchants')
          .update({ onboarding_complete: true })
          .eq('id', merchantId);
        logStep('Updated merchant onboarding_complete to true');
      }
    } catch (stripeError: unknown) {
      if (stripeError instanceof Error && stripeError.message.includes('No such account')) {
        throw new Error('Payment processing is not available for this merchant.');
      }
      throw stripeError;
    }

    // Get cashback rate based on subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    let cashbackRate = 10;
    let subscriptionTier = 'Free';

    // Check for manual subscription first
    if (subscription?.is_manual_upgrade && subscription?.subscription_tier) {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      if (!expiresAt || expiresAt > new Date()) {
        if (subscription.subscription_tier === 'pawpass_plus') {
          cashbackRate = 30;
          subscriptionTier = 'PawPass+';
        } else if (subscription.subscription_tier === 'pawpass') {
          cashbackRate = 20;
          subscriptionTier = 'PawPass';
        }
      }
    } else if (subscription?.stripe_subscription_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const productId = stripeSubscription.items.data[0]?.price?.product;
      
      if (productId === 'prod_TQyZjYzt9DwoIK') {
        cashbackRate = 30;
        subscriptionTier = 'PawPass+';
      } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
        cashbackRate = 20;
        subscriptionTier = 'PawPass';
      }
    }

    // Calculate amounts - PawBucks earned on Stripe portion only
    const stripeAmountInCents = Math.round(stripeAmount * 100);
    const pawbucksEarned = Math.round(stripeAmount * cashbackRate);
    // Success Fee: 3% applies ONLY to the non-tip Stripe portion.
    // Tips are always passed through 100% to the merchant (never charged a Success Fee).
    const feeableStripeAmount = Math.max(0, stripeAmount - tipAmount);
    const platformFeeInCents = Math.round(feeableStripeAmount * PLATFORM_FEE_PERCENT * 100);

    logStep('Stripe payment calculation', {
      stripeAmount,
      stripeAmountInCents,
      cashbackRate,
      pawbucksEarned,
      platformFeeInCents,
      subscriptionTier,
      pawbucksToDeduct: pawbucksAmount,
    });

    // ============================================================
    // DIRECT CHARGE: PaymentIntent created ON the connected account
    // ============================================================
    // Benefits:
    // - Stripe processing fees are paid by the merchant (connected account)
    // - Platform (PawBucks) only receives the application_fee_amount
    // - Zero negative balance risk for the platform
    // - Chargebacks are the merchant's responsibility
    // ============================================================
    
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: stripeAmountInCents,
        currency: 'usd',
        application_fee_amount: platformFeeInCents, // 3% platform fee
        payment_method_types: ['card'], // Explicit card-only for international compatibility
        metadata: {
          merchant_id: merchantId,
          user_id: user.id,
          effective_user_id: effectiveUserId,
          user_email: user.email || '',
          business_name: merchant.business_name,
          description: description || `Payment to ${merchant.business_name}`,
          subscription_tier: subscriptionTier,
          pawbucks_amount: pawbucksAmount.toString(),
          store_locked_pawbucks: storeLockedPawbucks.toString(),
          total_amount: totalAmount.toString(),
          tip_amount: tipAmount.toString(),
          pawbucks_earned: String(pawbucksEarned),
          platform: "pawbucks",
          charge_type: "direct",
        },
      },
      {
        stripeAccount: merchant.stripe_account_id, // DIRECT CHARGE: Created on connected account
      }
    );

    logStep('PaymentIntent created (Direct Charge)', { 
      paymentIntentId: paymentIntent.id,
      connectedAccount: merchant.stripe_account_id 
    });

    // Create pending payment record
    await supabaseAdmin
      .from("direct_payments")
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        connected_account_id: merchant.stripe_account_id,
        merchant_id: merchantId,
        user_id: user.id,
        amount: stripeAmountInCents,
        application_fee: platformFeeInCents,
        currency: "usd",
        status: "pending",
        description: description || `Payment to ${merchant.business_name}`,
        pawbucks_earned: pawbucksEarned,
        metadata: {
          business_name: merchant.business_name,
          charge_type: "direct",
          subscription_tier: subscriptionTier,
          pawbucks_amount: pawbucksAmount,
          total_amount: totalAmount,
          items: lineItems,
        },
      });

    logStep("Payment record created");

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: pawbucksAmount > 0 ? 'combined' : 'stripe_only',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        connectedAccountId: merchant.stripe_account_id, // Frontend needs this for Stripe.js
        stripeAmount,
        tipAmount,
        pawbucksAmount,
        pawbucksUsdValue,
        pawbucksEarned,
        cashbackRate,
        applicationFee: platformFeeInCents,
        merchantName: merchant.business_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    // Log full error details for debugging
    console.error('Combined payment error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    
    // Return helpful error message
    let userMessage = 'Payment processing failed. Please try again.';
    if (error instanceof Error) {
      if (error.message.includes('country') || error.message.includes('location')) {
        userMessage = 'Payment is not available from your current location. Please try again later.';
      } else if (error.message.includes('Merchant') || error.message.includes('merchant') || error.message.includes('PawBucks')) {
        userMessage = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
