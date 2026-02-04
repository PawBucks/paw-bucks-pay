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
    // Create admin client to lookup stripe_account_id securely
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // STEP 1: Validate Stripe API Key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    // STEP 2: Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    });

    // STEP 3: Get the merchantId from body (stripe_account_id is resolved server-side)
    let merchantId: string | null = null;
    let accountId: string | null = null;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      merchantId = url.searchParams.get('merchantId');
      accountId = url.searchParams.get('accountId'); // Legacy fallback
    } else {
      const body = await req.json();
      merchantId = body.merchantId;
      accountId = body.accountId; // Legacy fallback
    }

    // Resolve stripe_account_id from merchantId (secure server-side lookup)
    let stripeAccountId: string | null = null;

    if (merchantId) {
      const { data: merchant, error: merchantError } = await supabaseAdmin
        .from('merchants')
        .select('stripe_account_id')
        .eq('id', merchantId)
        .eq('approval_status', 'approved')
        .single();

      if (merchantError || !merchant?.stripe_account_id) {
        console.log('Merchant not found or no stripe account:', merchantId);
        return new Response(
          JSON.stringify({ 
            success: true, 
            products: [],
            message: 'Merchant not found or not connected to Stripe'
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }

      stripeAccountId = merchant.stripe_account_id;
    } else if (accountId) {
      // Legacy fallback: accountId provided directly (for backward compatibility)
      stripeAccountId = accountId;
    }

    if (!stripeAccountId) {
      throw new Error('merchantId is required');
    }

    console.log('Listing products for merchant:', merchantId, 'stripe account:', stripeAccountId.substring(0, 10) + '...');

    // STEP 4: List products from the CONNECTED ACCOUNT
    const products = await stripe.products.list(
      {
        limit: 100,
        active: true,
        expand: ['data.default_price'],
      },
      {
        stripeAccount: stripeAccountId,
      }
    );

    // STEP 5: Filter out subscription products (those with platform: "pawbucks" metadata)
    // Subscription products are managed separately via merchant_subscription_plans table
    const oneTimeProducts = products.data.filter((product: Stripe.Product) => {
      return product.metadata?.platform !== "pawbucks";
    });

    // STEP 6: Transform the products data
    const productsData = oneTimeProducts.map((product: Stripe.Product) => {
      const defaultPrice = product.default_price as Stripe.Price | null;
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        active: product.active,
        price: defaultPrice ? {
          id: defaultPrice.id,
          unit_amount: defaultPrice.unit_amount,
          currency: defaultPrice.currency,
          formatted: defaultPrice.unit_amount 
            ? `$${(defaultPrice.unit_amount / 100).toFixed(2)}`
            : 'N/A',
        } : null,
        metadata: product.metadata,
        created: product.created,
      };
    });

    console.log(`Found ${productsData.length} one-time products (filtered ${products.data.length - productsData.length} subscription products)`);

    // STEP 6: Return the products list
    return new Response(
      JSON.stringify({
        success: true,
        products: productsData,
        has_more: products.has_more,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error listing products:', errorMessage);
    
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
