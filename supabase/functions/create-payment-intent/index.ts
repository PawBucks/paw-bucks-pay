import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
  useWelcomeCredit: z.boolean().optional().default(false),
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

    const { amount, currency, merchantId, description, useWelcomeCredit } = validationResult.data;

    logStep('Request validated', { amount, merchantId, description, useWelcomeCredit });

    // Get merchant details including Stripe Connect account
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id, cashback_rate, business_name, onboarding_complete, accepts_welcome_credit')
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

    // ============================================================
    // WELCOME CREDIT VALIDATION (if requested)
    // ============================================================
    let welcomeCreditAmount = 0;
    let welcomeCreditId: string | null = null;
    const minWelcomeCreditTransaction = 75; // $75 minimum

    if (useWelcomeCredit) {
      // Validate merchant accepts welcome credit
      if (!merchant.accepts_welcome_credit) {
        throw new Error('This merchant does not accept Welcome Credit.');
      }

      // Validate minimum transaction amount
      if (amount < minWelcomeCreditTransaction) {
        throw new Error(`Minimum $${minWelcomeCreditTransaction} transaction required to use Welcome Credit.`);
      }

      // Get user's active welcome credit
      const { data: welcomeCredit, error: wcError } = await supabaseAdmin
        .from('user_welcome_credits')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      if (wcError || !welcomeCredit) {
        throw new Error('No active Welcome Credit found.');
      }

      // Check if expired
      if (new Date(welcomeCredit.expires_at) < new Date()) {
        await supabaseAdmin
          .from('user_welcome_credits')
          .update({ status: 'expired' })
          .eq('id', welcomeCredit.id);
        throw new Error('Your Welcome Credit has expired.');
      }

      // Check if user has any previous transactions (first transaction only)
      const { count: transactionCount } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (transactionCount && transactionCount > 0) {
        throw new Error('Welcome Credit can only be used on your first transaction.');
      }

      // Check if user has transacted with this merchant before
      const { count: merchantTransactionCount } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('merchant_id', merchantId);

      if (merchantTransactionCount && merchantTransactionCount > 0) {
        throw new Error('Welcome Credit can only be used on your first transaction with this merchant.');
      }

      // Credit cannot exceed transaction total (in cents)
      const amountInCentsForWelcome = Math.round(amount * 100);
      welcomeCreditAmount = Math.min(welcomeCredit.credit_amount, amountInCentsForWelcome);
      welcomeCreditId = welcomeCredit.id;

      logStep('Welcome Credit validated', {
        creditId: welcomeCreditId,
        creditAmount: welcomeCreditAmount,
        originalAmount: amountInCentsForWelcome,
      });
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
    
    // ============================================================
    // WELCOME CREDIT: Reduces the Stripe charge amount
    // Welcome Credit is a merchant-funded promotional discount
    // No reimbursement to merchant - this is their CAC
    // ============================================================
    const stripeAmountInCents = amountInCents - welcomeCreditAmount;
    
    // PawBucks earned is based on the STRIPE portion only (not the welcome credit)
    // This prevents gaming by using welcome credit to earn rewards
    const stripeAmountDollars = stripeAmountInCents / 100;
    const pawbucksEarned = stripeAmountInCents > 0 ? Math.round(stripeAmountDollars * cashbackRate) : 0;
    
    // Platform fee: 3% of STRIPE portion only (welcome credit has 0 fee)
    const platformFeeInCents = stripeAmountInCents > 0 ? Math.round(stripeAmountDollars * 0.03 * 100) : 0;

    logStep('Payment breakdown', {
      totalAmount: amount,
      welcomeCreditUsed: welcomeCreditAmount / 100,
      stripeAmount: stripeAmountInCents / 100,
      subscriptionTier,
      cashbackRate: `${cashbackRate}x`,
      pawbucksEarned,
      platformFee: platformFeeInCents / 100,
      merchantReceives: (stripeAmountInCents - platformFeeInCents) / 100,
    });

    // If welcome credit covers the entire transaction, no Stripe charge needed
    if (stripeAmountInCents <= 0) {
      // Mark welcome credit as used
      if (welcomeCreditId) {
        await supabaseAdmin
          .from('user_welcome_credits')
          .update({
            status: 'used',
            used_at: new Date().toISOString(),
            used_with_merchant_id: merchantId,
            transaction_total_cents: amountInCents,
          })
          .eq('id', welcomeCreditId);

        // Log analytics
        await supabaseAdmin
          .from('welcome_credit_analytics')
          .insert({
            event_type: 'credit_used',
            user_id: user.id,
            merchant_id: merchantId,
            event_data: {
              credit_id: welcomeCreditId,
              credit_applied: welcomeCreditAmount,
              transaction_total: amountInCents,
              fully_covered: true,
            },
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          fullyCovered: true,
          welcomeCreditApplied: welcomeCreditAmount,
          pawbucksEarned: 0, // No rewards for fully covered transactions
          merchantName: merchant.business_name,
          message: 'Transaction fully covered by Welcome Credit!',
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

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
        amount: stripeAmountInCents, // Reduced by welcome credit
        currency,
        application_fee_amount: platformFeeInCents, // 3% platform fee on Stripe portion
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
          welcome_credit_used: String(welcomeCreditAmount),
          welcome_credit_id: welcomeCreditId || '',
          original_amount: String(amountInCents),
        },
      },
      {
        stripeAccount: merchant.stripe_account_id, // DIRECT CHARGE: Created on connected account
      }
    );

    logStep('PaymentIntent created (Direct Charge)', { 
      paymentIntentId: paymentIntent.id,
      connectedAccount: merchant.stripe_account_id,
      welcomeCreditApplied: welcomeCreditAmount,
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
        currency,
        status: "pending",
        description: description || `Payment to ${merchant.business_name}`,
        pawbucks_earned: pawbucksEarned,
        metadata: {
          business_name: merchant.business_name,
          charge_type: "direct",
          subscription_tier: subscriptionTier,
          welcome_credit_used: welcomeCreditAmount,
          welcome_credit_id: welcomeCreditId,
          original_amount: amountInCents,
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
        amount: stripeAmountInCents,
        originalAmount: amountInCents,
        welcomeCreditApplied: welcomeCreditAmount,
        welcomeCreditId,
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
      } else if (error.message.includes('Welcome Credit') || error.message.includes('welcome credit')) {
        userMessage = error.message;
      } else if (error.message.includes('Minimum')) {
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
