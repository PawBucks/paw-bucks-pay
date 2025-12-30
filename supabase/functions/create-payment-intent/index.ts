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
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
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

    console.log('Creating payment intent:', { amount, merchantId, userId: user.id, description });

    // Get merchant details including Stripe Connect account
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id, cashback_rate, business_name')
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

    // Check user's subscription tier to determine cashback rate
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    let cashbackRate = 10; // Default 10x multiplier for free accounts
    let subscriptionTier = 'Free';

    if (subscription?.stripe_subscription_id) {
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
    
    console.log(`Cashback rate: ${cashbackRate}x (${subscriptionTier} user)`);

    // Calculate amounts with tier-based multipliers
    // cashbackRate is the multiplier (10x, 20x, 30x) meaning $1 = 10/20/30 PawBucks
    const amountInCents = Math.round(amount * 100);
    const pawbucksEarned = Math.round(amount * cashbackRate);
    // Platform fee: 3% of transaction for PawBucks platform
    const platformFeeInCents = Math.round(amount * 0.03 * 100);

    console.log('Payment breakdown:', {
      totalAmount: amount,
      subscriptionTier,
      cashbackRate: `${cashbackRate}x`,
      pawbucksEarned,
      platformFee: platformFeeInCents / 100,
      merchantReceives: (amountInCents - platformFeeInCents) / 100,
    });

    // Create a PaymentIntent with Stripe Connect
    // Using on_behalf_of ensures merchant's business info appears on customer statements
    // Explicitly specify card payment method for better international support
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      payment_method_types: ['card'], // Explicit card method for global compatibility
      on_behalf_of: merchant.stripe_account_id, // Shows merchant's business on customer statement
      application_fee_amount: platformFeeInCents, // Platform fee (used for cashback)
      transfer_data: {
        destination: merchant.stripe_account_id, // Send to merchant's Connect account
      },
      metadata: {
        merchant_id: merchantId,
        user_id: user.id,
        description: description || `Payment to ${merchant.business_name}`,
        subscription_tier: subscriptionTier,
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        pawbucksEarned,
        cashbackRate,
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
      raw: JSON.stringify(error, Object.getOwnPropertyNames(error as object)),
    });
    
    // Return helpful error message
    let userMessage = 'Payment processing failed. Please try again.';
    if (error instanceof Error) {
      if (error.message.includes('country') || error.message.includes('location')) {
        userMessage = 'Payment processing is not available in your current location. Please try again later.';
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
