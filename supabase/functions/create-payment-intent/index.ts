import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.22.4";

// Input validation schema
const paymentIntentSchema = z.object({
  amount: z.number()
    .positive({ message: "Amount must be greater than 0" })
    .max(1000000, { message: "Amount cannot exceed $1,000,000" }),
  merchantId: z.string()
    .uuid({ message: "Invalid merchant ID format" }),
  currency: z.string()
    .length(3, { message: "Currency must be 3-letter ISO code" })
    .toLowerCase()
    .optional()
    .default("usd"),
  description: z.string()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-PAYMENT-INTENT] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    // Get authenticated user
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

    // Validate input
    const validationResult = paymentIntentSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Invalid input';
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { amount, currency, merchantId, description } = validationResult.data;

    logStep('Request validated', { amount, merchantId, description });

    // Get merchant details including Stripe Connect account
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id, cashback_rate, business_name, onboarding_complete')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantId, merchantError);
      throw new Error('Unable to process payment. Please try again.');
    }

    if (!merchant.stripe_account_id) {
      console.error('Merchant Stripe account not configured:', merchantId);
      throw new Error('Payment processing is not available for this merchant.');
    }

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

    logStep("Merchant verified", { 
      merchantId, 
      stripeAccountId: merchant.stripe_account_id,
      businessName: merchant.business_name 
    });

    // Check user's subscription tier to determine cashback rate
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    let cashbackRate = 10; // Default 10x multiplier for free accounts
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
      // Get subscription details from Stripe to check product
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const productId = stripeSubscription.items.data[0]?.price?.product;
      
      // Set cashback rate (multiplier) based on product
      if (productId === 'prod_TQyZjYzt9DwoIK') {
        cashbackRate = 30; // PawPass+ gets 30x
        subscriptionTier = 'PawPass+';
      } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
        cashbackRate = 20; // PawPass gets 20x
        subscriptionTier = 'PawPass';
      }
    }
    
    logStep(`Cashback rate: ${cashbackRate}x (${subscriptionTier} user)`);

    // Calculate amounts with tier-based multipliers
    // cashbackRate is the multiplier (10x, 20x, 30x) meaning $1 = 10/20/30 PawBucks
    const amountInCents = Math.round(amount * 100);
    const pawbucksEarned = Math.round(amount * cashbackRate);
    // Platform fee: 3% of transaction for PawBucks platform
    const platformFeeInCents = Math.round(amount * 0.03 * 100);

    logStep('Payment breakdown', {
      totalAmount: amount,
      subscriptionTier,
      cashbackRate: `${cashbackRate}x`,
      pawbucksEarned,
      platformFee: platformFeeInCents / 100,
      merchantReceives: (amountInCents - platformFeeInCents) / 100,
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
        amount: amountInCents,
        currency,
        application_fee_amount: platformFeeInCents, // 3% platform fee
        automatic_payment_methods: { enabled: true },
        metadata: {
          merchant_id: merchantId,
          user_id: user.id,
          user_email: user.email || '',
          business_name: merchant.business_name,
          description: description || `Payment to ${merchant.business_name}`,
          subscription_tier: subscriptionTier,
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
        amount: amountInCents,
        application_fee: platformFeeInCents,
        currency,
        status: "pending",
        description: description || `Payment to ${merchant.business_name}`,
        pawbucks_earned: pawbucksEarned,
        metadata: {
          business_name: merchant.business_name,
          charge_type: "direct",
          subscription_tier: subscriptionTier,
        },
      });

    logStep("Payment record created");

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        connectedAccountId: merchant.stripe_account_id, // Frontend needs this for Stripe.js
        pawbucksEarned,
        cashbackRate,
        amount: amountInCents,
        applicationFee: platformFeeInCents,
        merchantName: merchant.business_name,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    // Log full error details for debugging
    console.error('Error creating payment intent:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    
    // Return helpful error message
    let userMessage = 'Payment processing failed. Please try again.';
    if (error instanceof Error) {
      if (error.message.includes('country') || error.message.includes('location')) {
        userMessage = 'Payment processing is not available in your current location. Please try again later.';
      } else if (error.message.includes('Merchant') || error.message.includes('merchant')) {
        userMessage = error.message;
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
