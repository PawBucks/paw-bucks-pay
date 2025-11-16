import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";

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
    const { accountId, priceId, quantity, successUrl, cancelUrl } = await req.json();

    // Validate required fields
    if (!accountId) {
      throw new Error('accountId is required');
    }
    if (!priceId) {
      throw new Error('priceId is required');
    }
    if (!quantity || quantity < 1) {
      throw new Error('quantity must be at least 1');
    }

    console.log(`Creating checkout for connected account ${accountId}, price ${priceId}`);

    // STEP 4: Calculate application fee (platform monetization)
    // This is how the platform makes money from transactions
    // Example: 10% platform fee
    const PLATFORM_FEE_PERCENTAGE = 0.10; // 10% fee
    
    // First, get the price details to calculate the fee
    const price = await stripe.prices.retrieve(priceId, {
      stripeAccount: accountId,
    });

    // Calculate application fee in cents
    // For example, on a $100 purchase, this would be $10 (1000 cents)
    let applicationFeeAmount = 0;
    if (price.unit_amount) {
      applicationFeeAmount = Math.round(price.unit_amount * quantity * PLATFORM_FEE_PERCENTAGE);
    }

    console.log(`Calculated application fee: $${(applicationFeeAmount / 100).toFixed(2)}`);

    // STEP 5: Create Checkout Session using DIRECT CHARGE with application fee
    // This charges the customer directly to the connected account
    // and automatically transfers the application fee to the platform
    const session = await stripe.checkout.sessions.create(
      {
        // Line items for the checkout
        line_items: [
          {
            price: priceId,
            quantity: quantity,
          },
        ],
        
        // Payment mode
        mode: 'payment', // One-time payment
        
        // CRITICAL: payment_intent_data contains the application fee
        // This is how the platform earns money from the transaction
        payment_intent_data: {
          // Application fee in cents
          // This amount goes to the platform account
          // The rest goes to the connected account (minus Stripe fees)
          application_fee_amount: applicationFeeAmount,
          
          // Optional: Add metadata for tracking
          metadata: {
            connected_account_id: accountId,
            platform_fee_percentage: (PLATFORM_FEE_PERCENTAGE * 100).toString(),
          },
        },
        
        // Success and cancel URLs
        success_url: successUrl || `${req.headers.get('origin')}/checkout-success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${req.headers.get('origin')}/checkout-canceled`,
        
        // Optional: Collect customer information
        customer_email: undefined, // Stripe will ask for email
      },
      {
        // IMPORTANT: Create checkout session on the connected account
        // This makes the connected account receive the payment
        stripeAccount: accountId,
      }
    );

    console.log('Checkout session created:', session.id);

    // STEP 6: Return the checkout session URL
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
