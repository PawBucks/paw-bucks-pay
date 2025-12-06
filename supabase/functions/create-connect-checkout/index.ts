import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // STEP 1: Validate Stripe API Key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    // STEP 2: Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    });

    // STEP 3: Parse request body
    const body = await req.json();
    const { accountId, priceId, quantity, successUrl, cancelUrl, productName } = body;

    // Validate required fields and input types
    if (!accountId || typeof accountId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'accountId is required and must be a string' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    if (!priceId || typeof priceId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'priceId is required and must be a string' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 100) {
      return new Response(
        JSON.stringify({ error: 'quantity must be a number between 1 and 100' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Creating checkout for connected account ${accountId}, price ${priceId}, user ${user.id}`);

    // STEP 4: Get merchant info from Supabase for rewards tracking
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name, cashback_rate')
      .eq('stripe_account_id', accountId)
      .single();

    const merchantId = merchant?.id || null;
    const merchantName = merchant?.business_name || 'Merchant Store';
    const cashbackRate = merchant?.cashback_rate || 10;

    console.log('Merchant found:', { merchantId, merchantName, cashbackRate });

    // STEP 5: Calculate application fee (platform monetization)
    const PLATFORM_FEE_PERCENTAGE = 0.10; // 10% fee
    
    // Get the price details to calculate the fee
    const price = await stripe.prices.retrieve(priceId, {
      stripeAccount: accountId,
    });

    // Calculate application fee in cents
    let applicationFeeAmount = 0;
    let totalAmountCents = 0;
    if (price.unit_amount) {
      totalAmountCents = price.unit_amount * quantity;
      applicationFeeAmount = Math.round(totalAmountCents * PLATFORM_FEE_PERCENTAGE);
    }

    const totalAmountDollars = totalAmountCents / 100;

    // Calculate PawBucks rewards for display
    // Check user's subscription tier for cashback calculation
    let userCashbackRate = 10; // Default 10x for free accounts
    
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (subscription?.stripe_subscription_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const productId = stripeSubscription.items.data[0]?.price?.product;
      
      if (productId === 'prod_TQyZjYzt9DwoIK') {
        userCashbackRate = 30; // PawPass+ gets 30x
      } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
        userCashbackRate = 20; // PawPass gets 20x
      }
    }

    // PawBucks earned = amount * (rate/100) * 10 (conversion factor)
    const estimatedPawBucks = Math.floor(totalAmountDollars * (userCashbackRate / 100) * 10);

    console.log(`Calculated: fee=$${(applicationFeeAmount / 100).toFixed(2)}, pawBucks=${estimatedPawBucks}`);

    // STEP 6: Create Checkout Session using DIRECT CHARGE with application fee
    const session = await stripe.checkout.sessions.create(
      {
        line_items: [
          {
            price: priceId,
            quantity: quantity,
          },
        ],
        
        mode: 'payment',
        
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          
          // CRITICAL: Add metadata for PawBucks rewards processing
          metadata: {
            connected_account_id: accountId,
            platform_fee_percentage: (PLATFORM_FEE_PERCENTAGE * 100).toString(),
            user_id: user.id,
            merchant_id: merchantId || '',
            source: 'merchant_storefront',
            product_name: productName || 'Storefront Purchase',
            description: `Purchase from ${merchantName}`,
          },
        },
        
        // Include session ID in success URL for verification
        success_url: successUrl || `${req.headers.get('origin')}/checkout-success?session_id={CHECKOUT_SESSION_ID}&store=${accountId}`,
        cancel_url: cancelUrl || `${req.headers.get('origin')}/checkout-canceled`,
        
        // Collect customer email for order confirmation
        customer_email: user.email,
      },
      {
        stripeAccount: accountId,
      }
    );

    console.log('Checkout session created:', session.id);

    // STEP 7: Return the checkout session URL with rewards info
    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
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
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating checkout session:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
