import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not configured.');

    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    const { productId, accountId, name, description, priceInCents, currency, active } = await req.json();

    if (!productId) throw new Error('productId is required');
    if (!accountId) throw new Error('accountId is required');

    // Verify the merchant owns this connected account
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .eq('stripe_account_id', accountId)
      .maybeSingle();
    if (!merchant) throw new Error('Unauthorized: account does not belong to this merchant');

    // Build product update payload
    const productUpdate: Stripe.ProductUpdateParams = {};
    if (typeof name === 'string') productUpdate.name = name;
    if (typeof description === 'string') productUpdate.description = description || null as any;
    if (typeof active === 'boolean') productUpdate.active = active;

    // If price changed, create a new Price and set as default (Stripe prices are immutable)
    if (typeof priceInCents === 'number' && priceInCents >= 50) {
      const newPrice = await stripe.prices.create(
        {
          product: productId,
          unit_amount: priceInCents,
          currency: currency || 'usd',
        },
        { stripeAccount: accountId }
      );
      productUpdate.default_price = newPrice.id;
    }

    const product = await stripe.products.update(
      productId,
      productUpdate,
      { stripeAccount: accountId }
    );

    return new Response(
      JSON.stringify({
        success: true,
        product: {
          id: product.id,
          name: product.name,
          description: product.description,
          default_price: product.default_price,
          active: product.active,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error updating product:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
