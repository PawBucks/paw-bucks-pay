import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// PawPass subscription price IDs (PawBucks, Inc. platform account)
const PRICE_IDS = {
  basic: 'price_1St3KuHn6eXqpJI78rnXt0UP', // PawPass $10/month
  plus: 'price_1St3LbHn6eXqpJI7ZtIFPaKu',  // PawPass+ $20/month
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Creating subscription checkout session');

    // Parse request body for tier selection
    const { tier = 'basic', autoRedeem = false } = await req.json();
    console.log('Selected tier:', tier, 'autoRedeem:', autoRedeem);

    // Validate tier
    if (!['basic', 'plus'].includes(tier)) {
      throw new Error('Invalid subscription tier');
    }

    const selectedPriceId = PRICE_IDS[tier as 'basic' | 'plus'];

    // Authenticate user
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

    if (userError || !user?.email) {
      throw new Error('User not authenticated');
    }

    console.log('User authenticated:', { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    // Check if customer already exists
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      console.log('Existing customer found:', customerId);
    } else {
      console.log('Creating new Stripe customer');
    }

    // --- Auto-Redeem PawBucks for Subscriptions ---
    const PAWBUCKS_TO_USD_RATE = 1000; // 1000 PB = $1
    let pawbucksUsed = 0;
    let couponId: string | undefined;
    const subscriptionPriceCents = tier === 'plus' ? 2000 : 1000; // $10 or $20

    if (autoRedeem) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const { data: arProfile } = await supabaseAdmin
        .from('profiles')
        .select('auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct')
        .eq('id', user.id)
        .single();

      const autoRedeemMode = arProfile?.auto_redeem_mode || 'off';
      const minCoveragePct = arProfile?.auto_redeem_min_coverage_pct ?? 20;
      const maxApplyPct = arProfile?.auto_redeem_max_apply_pct ?? 50;

      console.log('Auto-redeem check (subscription)', { autoRedeemMode, minCoveragePct, maxApplyPct });

      if (autoRedeemMode === 'subscriptions_only' || autoRedeemMode === 'always' || autoRedeemMode === 'smart') {
        const { data: walletData } = await supabaseAdmin
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        const availablePB = walletData?.balance || 0;
        const subscriptionPriceUsd = subscriptionPriceCents / 100;

        if (availablePB > 0) {
          let shouldApply = false;
          let maxPBToApply = availablePB;

          if (autoRedeemMode === 'always' || autoRedeemMode === 'subscriptions_only') {
            shouldApply = true;
          } else if (autoRedeemMode === 'smart') {
            const availableUsd = availablePB / PAWBUCKS_TO_USD_RATE;
            const coveragePct = (availableUsd / subscriptionPriceUsd) * 100;
            if (coveragePct >= minCoveragePct) {
              shouldApply = true;
              const maxUsd = subscriptionPriceUsd * (maxApplyPct / 100);
              maxPBToApply = Math.min(availablePB, Math.floor(maxUsd * PAWBUCKS_TO_USD_RATE));
            }
          }

          if (shouldApply && maxPBToApply > 0) {
            // Cap at subscription price
            let pbUsd = maxPBToApply / PAWBUCKS_TO_USD_RATE;
            if (pbUsd > subscriptionPriceUsd) {
              pbUsd = subscriptionPriceUsd;
              maxPBToApply = Math.floor(pbUsd * PAWBUCKS_TO_USD_RATE);
            }

            const discountCents = Math.round(pbUsd * 100);

            if (discountCents > 0 && discountCents < subscriptionPriceCents) {
              // Create a one-time Stripe coupon for this subscription
              const coupon = await stripe.coupons.create({
                amount_off: discountCents,
                currency: 'usd',
                duration: 'once',
                name: `PawBucks Auto-Redeem (${maxPBToApply.toLocaleString()} PB)`,
                max_redemptions: 1,
              });
              couponId = coupon.id;
              pawbucksUsed = maxPBToApply;

              // ⚠️ DEFERRED DEBIT: PawBucks are NOT deducted here. The
              // stripe-webhook deducts them on `checkout.session.completed`
              // so abandoned checkouts never charge the user's wallet.
              console.log('Auto-redeem coupon prepared (deferred debit)', { pawbucksUsed, discountCents, couponId });
            } else if (discountCents >= subscriptionPriceCents) {
              // Full coverage - create coupon for 100% off first month
              const coupon = await stripe.coupons.create({
                percent_off: 100,
                duration: 'once',
                name: `PawBucks Auto-Redeem (Full Month)`,
                max_redemptions: 1,
              });
              couponId = coupon.id;
              pawbucksUsed = Math.floor(subscriptionPriceUsd * PAWBUCKS_TO_USD_RATE);

              // ⚠️ DEFERRED DEBIT (see above).
              console.log('Full-month coupon prepared (deferred debit)', { pawbucksUsed, couponId });
            }
          }
        }
      }
    }

    // Create Checkout session with 7-day trial
    // Using explicit payment methods for better international support
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: selectedPriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      // Explicitly specify payment methods that work globally
      payment_method_types: ['card'],
      // Collect billing address for international tax compliance
      billing_address_collection: 'auto',
      ...(couponId ? { discounts: [{ coupon: couponId }] } : {}),
      subscription_data: {
        trial_period_days: 7,
        metadata: {
          user_id: user.id,
          tier: tier,
          pawbucks_used: pawbucksUsed.toString(),
          subscription_purpose: 'pawpass_subscription',
        },
      },
      success_url: `${req.headers.get('origin')}/subscription-success`,
      cancel_url: `${req.headers.get('origin')}/profile`,
      metadata: {
        user_id: user.id,
        tier: tier,
        pawbucks_used: pawbucksUsed.toString(),
        subscription_purpose: 'pawpass_subscription',
      },
    });

    console.log('Checkout session created:', session.id);

    return new Response(
      JSON.stringify({ url: session.url }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    // Log full error details for debugging
    console.error('Error creating subscription checkout:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
      raw: JSON.stringify(error, Object.getOwnPropertyNames(error as object)),
    });
    
    // Return a more helpful error message
    let userMessage = 'Failed to create checkout session. Please try again.';
    if (error instanceof Error) {
      // Check for common Stripe errors
      if (error.message.includes('country') || error.message.includes('location')) {
        userMessage = 'Payment processing is currently not available in your location. Please try again or contact support.';
      } else if (error.message.includes('currency')) {
        userMessage = 'Currency not supported. Please contact support.';
      }
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
