import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  getSpendableSources,
  planPawBucksDebit,
  applyPawBucksDebit,
} from "../_shared/pet-fund-debit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// PawBucks to USD conversion: 1000 PawBucks = $1 USD
const PAWBUCKS_TO_USD = 1000;
const PLATFORM_FEE_PERCENTAGE = 0.03; // 3% platform fee

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-CONNECT-CHECKOUT] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    logStep("User authenticated", { userId: user.id });

    // Initialize Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    // Parse request body
    const body = await req.json();
    const { 
      merchantId: bodyMerchantId, 
      accountId: legacyAccountId, 
      priceId, 
      quantity, 
      successUrl, 
      cancelUrl, 
      productName, 
      pawbucksToUse: manualPawbucksToUse,
      autoRedeem: requestAutoRedeem,
      items: cartItems, // Multi-item support: Array<{ priceId, quantity, name? }>
    } = body;

    // Create admin client for secure lookups
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Resolve merchant details from merchantId
    let accountId: string | null = null;
    let merchantId: string | null = null;
    let merchantName = 'Merchant Store';
    let cashbackRate = 10;
    let merchantAcceptsPawBucks = false;
    let onboardingComplete = false;

    if (bodyMerchantId && typeof bodyMerchantId === 'string') {
      const { data: merchant, error: merchantError } = await supabaseAdmin
        .from('merchants')
        .select('id, stripe_account_id, business_name, cashback_rate, accepts_pawbucks, onboarding_complete')
        .eq('id', bodyMerchantId)
        .eq('approval_status', 'approved')
        .single();

      if (merchantError || !merchant?.stripe_account_id) {
        return new Response(
          JSON.stringify({ error: 'Merchant not found or not connected to Stripe' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      accountId = merchant.stripe_account_id;
      merchantId = merchant.id;
      merchantName = merchant.business_name || 'Merchant Store';
      cashbackRate = merchant.cashback_rate || 10;
      merchantAcceptsPawBucks = merchant.accepts_pawbucks || false;
      onboardingComplete = merchant.onboarding_complete || false;
    } else if (legacyAccountId && typeof legacyAccountId === 'string') {
      accountId = legacyAccountId;
      
      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('id, business_name, cashback_rate, accepts_pawbucks, onboarding_complete')
        .eq('stripe_account_id', legacyAccountId)
        .single();

      merchantId = merchant?.id || null;
      merchantName = merchant?.business_name || 'Merchant Store';
      cashbackRate = merchant?.cashback_rate || 10;
      merchantAcceptsPawBucks = merchant?.accepts_pawbucks || false;
      onboardingComplete = merchant?.onboarding_complete || false;
    } else {
      return new Response(
        JSON.stringify({ error: 'merchantId is required' }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    if (!onboardingComplete) {
      return new Response(
        JSON.stringify({ error: "Merchant's Stripe account setup is incomplete" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Build line items array - support both single-item (legacy) and multi-item
    type LineItemInfo = { priceId: string; quantity: number; name?: string; unitAmount: number; currency: string };
    const lineItemsToProcess: LineItemInfo[] = [];

    if (Array.isArray(cartItems) && cartItems.length > 0) {
      // Multi-item cart checkout
      for (const ci of cartItems) {
        if (!ci.priceId || typeof ci.priceId !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Each cart item must have a valid priceId' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }
        const qty = typeof ci.quantity === 'number' && ci.quantity >= 1 && ci.quantity <= 100 ? ci.quantity : 1;
        const connectedPrice = await stripe.prices.retrieve(ci.priceId, { stripeAccount: accountId });
        if (connectedPrice.type === 'recurring') {
          return new Response(
            JSON.stringify({ error: 'Subscription items cannot be added to cart. Please subscribe separately.', error_code: 'subscription_not_supported' }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
          );
        }
        lineItemsToProcess.push({
          priceId: ci.priceId,
          quantity: qty,
          name: ci.name || undefined,
          unitAmount: connectedPrice.unit_amount || 0,
          currency: connectedPrice.currency || 'usd',
        });
      }
    } else {
      // Legacy single-item checkout
      if (!priceId || typeof priceId !== 'string') {
        return new Response(
          JSON.stringify({ error: 'priceId is required and must be a string' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 100) {
        return new Response(
          JSON.stringify({ error: 'quantity must be a number between 1 and 100' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }

      const connectedPrice = await stripe.prices.retrieve(priceId, { stripeAccount: accountId });
      if (connectedPrice.type === 'recurring') {
        return new Response(
          JSON.stringify({ error: 'Subscription purchases through merchant storefronts are not yet supported. Please contact the merchant directly.', error_code: 'subscription_not_supported' }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
        );
      }
      lineItemsToProcess.push({
        priceId,
        quantity,
        name: productName || undefined,
        unitAmount: connectedPrice.unit_amount || 0,
        currency: connectedPrice.currency || 'usd',
      });
    }

    // Calculate total amount in cents from all items
    let totalAmountCents = lineItemsToProcess.reduce((sum, li) => sum + li.unitAmount * li.quantity, 0);

    // Recurring prices are rejected above, so this is always false for cart checkouts
    const isRecurringPrice = false;

    const totalAmountDollars = totalAmountCents / 100;

    // Handle PawBucks
    let pawbucksUsed = 0;
    let pawbucksUsdValue = 0;
    let finalStripeAmountCents = totalAmountCents;

    const hasManualPawBucks = typeof manualPawbucksToUse === 'number' && manualPawbucksToUse > 0;
    
    if (merchantAcceptsPawBucks) {
      // Pull the full spendable picture: wallet + pet fund (welcome credit) + legacy welcome credit.
      const spendable = await getSpendableSources(supabaseAdmin, user.id);
      const petFundEligible =
        spendable.petFundAvailable > 0 &&
        (!spendable.petFundMinUsd || totalAmountDollars >= spendable.petFundMinUsd);
      const availablePawBucks =
        spendable.walletBalance +
        (petFundEligible ? spendable.petFundAvailable : 0) +
        spendable.legacyCreditBalance;

      logStep('Spendable PawBucks sources', {
        wallet: spendable.walletBalance,
        petFundAvailable: spendable.petFundAvailable,
        petFundMinUsd: spendable.petFundMinUsd,
        petFundEligible,
        legacy: spendable.legacyCreditBalance,
        availableTotal: availablePawBucks,
        totalAmountDollars,
      });

      if (hasManualPawBucks) {
        // Manual PawBucks selection
        pawbucksUsed = Math.min(manualPawbucksToUse, availablePawBucks);
        pawbucksUsdValue = pawbucksUsed / PAWBUCKS_TO_USD;
        
        if (pawbucksUsdValue > totalAmountDollars) {
          pawbucksUsdValue = totalAmountDollars;
          pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);
        }
        
        finalStripeAmountCents = Math.round((totalAmountDollars - pawbucksUsdValue) * 100);
        
        logStep('PawBucks applied (manual)', {
          requested: manualPawbucksToUse,
          applied: pawbucksUsed,
          usdValue: `$${pawbucksUsdValue.toFixed(2)}`,
          remainingStripe: `$${(finalStripeAmountCents / 100).toFixed(2)}`,
        });
      } else if (requestAutoRedeem && availablePawBucks > 0) {
        // Auto-redeem: look up user's preferences from profile
        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct')
          .eq('id', user.id)
          .single();

        const autoRedeemMode = profile?.auto_redeem_mode || 'off';
        const minCoveragePct = profile?.auto_redeem_min_coverage_pct ?? 20;
        const maxApplyPct = profile?.auto_redeem_max_apply_pct ?? 50;

        logStep('Auto-redeem check', { autoRedeemMode, minCoveragePct, maxApplyPct, availablePawBucks, isRecurringPrice });

        let shouldAutoRedeem = false;
        let maxPawBucksToApply = availablePawBucks;

        if (autoRedeemMode === 'always') {
          shouldAutoRedeem = true;
        } else if (autoRedeemMode === 'subscriptions_only') {
          // Only auto-redeem for recurring/subscription purchases
          shouldAutoRedeem = isRecurringPrice;
        } else if (autoRedeemMode === 'smart') {
          // Smart mode: check coverage thresholds
          const availableUsd = availablePawBucks / PAWBUCKS_TO_USD;
          const coveragePct = (availableUsd / totalAmountDollars) * 100;

          if (coveragePct >= minCoveragePct) {
            shouldAutoRedeem = true;
            // Cap at maxApplyPct of purchase value
            const maxUsd = totalAmountDollars * (maxApplyPct / 100);
            maxPawBucksToApply = Math.min(availablePawBucks, Math.floor(maxUsd * PAWBUCKS_TO_USD));
          }

          logStep('Smart auto-redeem evaluation', { coveragePct: coveragePct.toFixed(1), minCoveragePct, maxApplyPct, shouldAutoRedeem });
        }

        if (shouldAutoRedeem && maxPawBucksToApply > 0) {
          pawbucksUsed = maxPawBucksToApply;
          pawbucksUsdValue = pawbucksUsed / PAWBUCKS_TO_USD;

          if (pawbucksUsdValue > totalAmountDollars) {
            pawbucksUsdValue = totalAmountDollars;
            pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);
          }

          finalStripeAmountCents = Math.round((totalAmountDollars - pawbucksUsdValue) * 100);

          logStep('PawBucks applied (auto-redeem)', {
            mode: autoRedeemMode,
            applied: pawbucksUsed,
            usdValue: `$${pawbucksUsdValue.toFixed(2)}`,
            remainingStripe: `$${(finalStripeAmountCents / 100).toFixed(2)}`,
          });
        }
      } else {
        // ============================================================
        // PROMOTIONAL CREDIT AUTO-APPLY (always-on safety net)
        // ------------------------------------------------------------
        // Welcome credits (Pet Fund + legacy) are promotional onboarding
        // funds designed to be applied automatically. The storefront UI
        // hides the PawBucks slider until balances finish loading, so a
        // fast shopper could otherwise pay full price while $20+ in
        // welcome credit sits unused. We never auto-spend the user's
        // earned wallet balance here — that still requires the slider /
        // explicit autoRedeem opt-in.
        // ============================================================
        const promoEligible =
          (petFundEligible ? spendable.petFundAvailable : 0) +
          spendable.legacyCreditBalance;

        if (promoEligible > 0) {
          const maxPromoPawBucks = Math.floor(totalAmountDollars * PAWBUCKS_TO_USD);
          pawbucksUsed = Math.min(promoEligible, maxPromoPawBucks);
          pawbucksUsdValue = pawbucksUsed / PAWBUCKS_TO_USD;
          finalStripeAmountCents = Math.round((totalAmountDollars - pawbucksUsdValue) * 100);

          logStep('Promotional credit auto-applied', {
            petFundApplied: petFundEligible ? Math.min(spendable.petFundAvailable, pawbucksUsed) : 0,
            legacyApplied: Math.max(0, pawbucksUsed - (petFundEligible ? spendable.petFundAvailable : 0)),
            usdValue: `$${pawbucksUsdValue.toFixed(2)}`,
            remainingStripe: `$${(finalStripeAmountCents / 100).toFixed(2)}`,
          });
        }
      }
    }

    // Calculate application fee based on final Stripe amount
    let applicationFeeAmount = 0;
    if (finalStripeAmountCents > 0) {
      applicationFeeAmount = Math.round(finalStripeAmountCents * PLATFORM_FEE_PERCENTAGE);
    }

    let finalAmountDollars = finalStripeAmountCents / 100;

    // Check user's subscription tier for cashback calculation
    let userCashbackRate = 10;
    
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    // Check for manual subscription first
    if (subscription?.is_manual_upgrade && subscription?.subscription_tier) {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      if (!expiresAt || expiresAt > new Date()) {
        if (subscription.subscription_tier === 'pawpass_plus') {
          userCashbackRate = 30;
        } else if (subscription.subscription_tier === 'pawpass') {
          userCashbackRate = 20;
        }
      }
    } else if (subscription?.stripe_subscription_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const productId = stripeSubscription.items.data[0]?.price?.product;
      
      if (productId === 'prod_TQyZjYzt9DwoIK') {
        userCashbackRate = 30;
      } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
        userCashbackRate = 20;
      }
    }

    // PawBucks earned based on remaining Stripe amount only
    const estimatedPawBucks = Math.floor(finalAmountDollars * userCashbackRate);

    logStep('Payment calculation', { 
      totalAmount: totalAmountDollars,
      finalStripeAmount: finalAmountDollars,
      applicationFee: applicationFeeAmount / 100,
      estimatedPawBucks,
      userCashbackRate
    });

    // Handle case where PawBucks covers the full amount
    if (finalStripeAmountCents <= 0) {
      logStep('Full amount covered by PawBucks - no Stripe checkout needed');

      // ============================================================
      // IDEMPOTENCY CHECK: Prevent duplicate PawBucks-only transactions
      // ============================================================
      if (merchantId) {
        const sixtySecondsAgo = new Date(Date.now() - 60_000).toISOString();
        const { data: recentDuplicate } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('user_id', user.id)
          .eq('merchant_id', merchantId)
          .eq('amount', totalAmountDollars)
          .eq('stripe_amount', 0)
          .eq('status', 'completed')
          .gte('created_at', sixtySecondsAgo)
          .limit(1)
          .maybeSingle();

        if (recentDuplicate) {
          logStep("Duplicate PawBucks checkout detected", { existingId: recentDuplicate.id });
          return new Response(
            JSON.stringify({
              success: true,
              paid_with_pawbucks: true,
              pawbucks_used: pawbucksUsed,
              duplicate: true,
              redirect_url: successUrl || `${req.headers.get('origin')}/checkout-success`,
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          );
        }
      }

      // Deduct PawBucks from user's wallet (and welcome credit if needed)
      if (pawbucksUsed > 0) {
        // Use shared debit helper so wallet → pet fund (welcome credit) → legacy welcome credit
        // are all spent in the canonical order.
        const debitSources = await getSpendableSources(supabaseAdmin, user.id);
        const debitPlan = planPawBucksDebit(debitSources, pawbucksUsed, totalAmountDollars);
        await applyPawBucksDebit(supabaseAdmin, user.id, debitPlan, {
          merchantId,
          transactionTotalCents: totalAmountCents,
        });

        if (debitPlan.walletDeduction > 0) {
          await supabaseAdmin
            .from('pawbucks_activity')
            .insert({
              user_id: user.id,
              type: 'redeem',
              amount: debitPlan.walletDeduction,
              source: 'Purchase',
              partner_id: merchantId || null,
              description: `Paid ${debitPlan.walletDeduction} PawBucks ($${(debitPlan.walletDeduction * 0.001).toFixed(2)}) at ${merchantName}`,
            });
        }
        logStep('PawBucks debit plan applied (full PawBucks checkout)', debitPlan);
          
        // Credit merchant's PawBucks wallet
        if (merchantId) {
            let { data: merchantWallet } = await supabaseAdmin
              .from('merchant_pawbucks_wallet')
              .select('balance')
              .eq('merchant_id', merchantId)
              .single();
            
            if (!merchantWallet) {
              const { data: newWallet } = await supabaseAdmin
                .from('merchant_pawbucks_wallet')
                .insert({ merchant_id: merchantId, balance: 0 })
                .select('balance')
                .single();
              merchantWallet = newWallet;
            }
            
            if (merchantWallet) {
              await supabaseAdmin
                .from('merchant_pawbucks_wallet')
                .update({ balance: merchantWallet.balance + pawbucksUsed })
                .eq('merchant_id', merchantId);
              
              await supabaseAdmin
                .from('merchant_pawbucks_activity')
                .insert({
                  merchant_id: merchantId,
                  type: 'earn',
                  amount: pawbucksUsed,
                  source: 'Customer Payment',
                  customer_user_id: user.id,
                  description: `Received ${pawbucksUsed} PawBucks from customer`,
                });
            }
        }
        
        logStep('PawBucks deducted for full PawBucks checkout', {
          pawbucksUsed,
          walletDeduction: debitPlan.walletDeduction,
          petFundDeduction: debitPlan.petFundDeduction,
          legacyCreditDeduction: debitPlan.legacyCreditDeduction,
        });
      }
      
      // Create a transaction record - NO platform fee on PawBucks-only payments
      if (merchantId) {
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: user.id,
            merchant_id: merchantId,
            amount: totalAmountDollars,
            stripe_amount: 0,
            pawbucks_used: pawbucksUsed,
            application_fee: 0,
            cashback_earned: 0,
            rewards_earned: 0,
            description: `Purchase at ${merchantName} (paid with PawBucks)`,
            status: 'completed',
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          paid_with_pawbucks: true,
          pawbucks_used: pawbucksUsed,
          pawbucks_usd_value: pawbucksUsdValue,
          message: `Purchase paid with ${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)})`,
          redirect_url: successUrl || `${req.headers.get('origin')}/checkout-success`,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // ============================================================
    // DIRECT CHARGE: Checkout Session created ON the connected account
    // ============================================================
    // Benefits:
    // - Stripe processing fees are paid by the merchant (connected account)
    // - Platform (PawBucks) only receives the application_fee_amount
    // - Zero negative balance risk for the platform
    // - Chargebacks are the merchant's responsibility
    // ============================================================

    const itemNames = lineItemsToProcess.map(li => li.name).filter(Boolean).join(', ');
    const metadata = {
      connected_account_id: accountId,
      platform_fee_percentage: (PLATFORM_FEE_PERCENTAGE * 100).toString(),
      user_id: user.id,
      merchant_id: merchantId || '',
      business_name: merchantName,
      source: 'merchant_storefront',
      product_name: itemNames || productName || merchantName,
      description: `Purchase from ${merchantName}`,
      original_amount_cents: totalAmountCents.toString(),
      total_amount: totalAmountDollars.toFixed(2),
      pawbucks_amount: pawbucksUsed.toString(),
      pawbucks_used: pawbucksUsed.toString(),
      pawbucks_usd_value: pawbucksUsdValue.toFixed(2),
      debit_timing: 'post_payment',
      charge_type: 'direct',
      item_count: lineItemsToProcess.length.toString(),
    };

    // Build Stripe line_items
    // If PawBucks discount applies, use a single combined line item (Stripe doesn't support negative line items)
    let stripeLineItems;
    if (pawbucksUsed > 0) {
      stripeLineItems = [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: lineItemsToProcess.length === 1
                ? (lineItemsToProcess[0].name || `Purchase from ${merchantName}`)
                : `Order from ${merchantName} (${lineItemsToProcess.length} items)`,
              description: `Original: $${totalAmountDollars.toFixed(2)} - PawBucks: $${pawbucksUsdValue.toFixed(2)}`,
            },
            unit_amount: finalStripeAmountCents,
          },
          quantity: 1,
        },
      ];
    } else {
      // No PawBucks - show individual line items for better UX
      stripeLineItems = lineItemsToProcess.map(li => ({
        price_data: {
          currency: li.currency || 'usd',
          product_data: {
            name: li.name || `Product from ${merchantName}`,
          },
          unit_amount: li.unitAmount,
        },
        quantity: li.quantity,
      }));
    }

    // Create Checkout Session ON the connected account (Direct Charge)
    const session = await stripe.checkout.sessions.create(
      {
        line_items: stripeLineItems,
        mode: 'payment',
        success_url: successUrl || `${req.headers.get('origin')}/checkout-success?session_id={CHECKOUT_SESSION_ID}&store=${accountId}`,
        cancel_url: cancelUrl || `${req.headers.get('origin')}/checkout-canceled`,
        customer_email: user.email,
        metadata,
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          metadata,
        },
      },
      {
        stripeAccount: accountId,
      }
    );

    logStep('Direct Charge checkout session created', { sessionId: session.id, connectedAccount: accountId });

    // PawBucks are intentionally NOT debited here. For card + PawBucks storefront
    // checkouts, the debit happens only after Stripe confirms payment in connect-webhook.
    // This prevents abandoned or failed Stripe sessions from consuming a shopper's balance.

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        connected_account_id: accountId, // Frontend needs this for proper redirect handling
        application_fee: {
          amount: applicationFeeAmount,
          percentage: PLATFORM_FEE_PERCENTAGE * 100,
          formatted: `$${(applicationFeeAmount / 100).toFixed(2)}`,
        },
        rewards: {
          cashback_rate: userCashbackRate,
          estimated_pawbucks: estimatedPawBucks,
          formatted: `+${estimatedPawBucks} PawBucks`,
        },
        pawbucks_applied: pawbucksUsed > 0 ? {
          pawbucks_used: pawbucksUsed,
          usd_value: pawbucksUsdValue,
          formatted: `${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)})`,
        } : null,
        original_amount: totalAmountDollars,
        final_stripe_amount: finalAmountDollars,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    let errorMessage = 'An unexpected error occurred';
    let errorCode = 'unknown_error';
    let errorType = 'unknown';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      const stripeError = error as any;
      if (stripeError.type) errorType = stripeError.type;
      if (stripeError.code) errorCode = stripeError.code;
      if (stripeError.raw?.message) errorMessage = stripeError.raw.message;
      
      console.error('Error creating checkout session:', {
        message: errorMessage,
        type: errorType,
        code: errorCode,
        stack: error.stack,
      });
    } else {
      console.error('Non-Error exception:', error);
    }
    
    // Provide user-friendly error messages
    let userMessage = errorMessage;
    if (errorCode === 'resource_missing' || errorMessage.includes('No such price')) {
      userMessage = 'This product is no longer available. Please contact the merchant.';
    } else if (errorCode === 'account_invalid' || errorMessage.includes('account')) {
      userMessage = 'The merchant\'s payment setup is incomplete. Please try again later.';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('API key')) {
      userMessage = 'Payment service configuration error. Please contact support.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        error_code: errorCode,
        error_type: errorType,
        success: false,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
