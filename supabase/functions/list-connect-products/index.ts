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

    // STEP 3: Get the connected account ID from query params or body
    let accountId: string;
    
    if (req.method === 'GET') {
      const url = new URL(req.url);
      accountId = url.searchParams.get('accountId') || '';
    } else {
      const body = await req.json();
      accountId = body.accountId;
    }

    if (!accountId) {
      throw new Error('accountId is required');
    }

    console.log('Listing products for connected account:', accountId);

    // STEP 4: List products from the CONNECTED ACCOUNT
    // CRITICAL: Use stripeAccount parameter to list products from connected account
    // Without this, it would list products from the platform account
    const products = await stripe.products.list(
      {
        limit: 100, // Adjust based on your needs
        active: true, // Only get active products
        expand: ['data.default_price'], // Include price details in response
      },
      {
        // IMPORTANT: This fetches products from the connected account
        stripeAccount: accountId,
      }
    );

    // STEP 5: Transform the products data for easier consumption
    const productsData = products.data.map((product: Stripe.Product) => {
      // Extract price information if available
      const defaultPrice = product.default_price as Stripe.Price | null;
      
      return {
        id: product.id,
        name: product.name,
        description: product.description,
        images: product.images,
        active: product.active,
        // Price details if available
        price: defaultPrice ? {
          id: defaultPrice.id,
          unit_amount: defaultPrice.unit_amount,
          currency: defaultPrice.currency,
          // Format for display (e.g., "$10.00")
          formatted: defaultPrice.unit_amount 
            ? `$${(defaultPrice.unit_amount / 100).toFixed(2)}`
            : 'N/A',
        } : null,
        metadata: product.metadata,
        created: product.created,
      };
    });

    console.log(`Found ${productsData.length} products`);

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
