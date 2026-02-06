import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

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
      throw new Error('STRIPE_SECRET_KEY is not configured. Please add it to your Supabase secrets.');
    }

    // STEP 2: Initialize Stripe with latest API version
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2024-12-18.acacia',
    });

    // STEP 3: Authenticate the user
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

    // STEP 4: Parse request body with product details
    const { accountId, name, description, priceInCents, currency } = await req.json();

    // Validate required fields
    if (!accountId) {
      throw new Error('accountId is required');
    }
    if (!name) {
      throw new Error('Product name is required');
    }
    if (!priceInCents || priceInCents < 50) {
      throw new Error('Price must be at least $0.50 (50 cents)');
    }

    console.log(`Creating product "${name}" for connected account:`, accountId);

    // STEP 5: Create product on the CONNECTED ACCOUNT (not platform)
    // CRITICAL: Use the stripeAccount parameter to create on connected account
    // This adds the Stripe-Account header to the API request
    const product = await stripe.products.create(
      {
        // Product details
        name: name,
        description: description || undefined,
        
        // Create the default price inline with the product
        // This is more efficient than creating product and price separately
        default_price_data: {
          unit_amount: priceInCents, // Price in cents (e.g., 1000 = $10.00)
          currency: currency || 'usd', // Currency code (usd, eur, gbp, etc.)
        },
        
        // Make product active immediately
        active: true,
      },
      {
        // IMPORTANT: This header makes the product belong to the connected account
        // Without this, the product would be created on the platform account
        stripeAccount: accountId,
      }
    );

    console.log('Product created successfully:', product.id);

    // STEP 6: Return the created product details
    return new Response(
      JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          default_price: product.default_price, // The price ID for creating checkout sessions
          images: product.images,
          active: product.active,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating product:', errorMessage);
    
    // Provide helpful error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('No such account')) {
      userMessage = 'Invalid Stripe account ID. Please ensure the account exists and is properly connected.';
    } else if (errorMessage.includes('STRIPE_SECRET_KEY')) {
      userMessage = 'Stripe is not configured. Please contact support.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
