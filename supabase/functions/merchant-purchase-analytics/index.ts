import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Merchant conversion rate: 50 PawBucks = $1 for platform services
const MERCHANT_PAWBUCKS_TO_USD = 0.02;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    const { product_id, payment_method } = await req.json();

    if (!product_id || !payment_method) {
      throw new Error("Product ID and payment method are required");
    }

    if (!['usd', 'pawbucks'].includes(payment_method)) {
      throw new Error("Invalid payment method");
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    // Get product
    const { data: product, error: productError } = await supabaseClient
      .from('merchant_analytics_products')
      .select('*')
      .eq('id', product_id)
      .eq('is_active', true)
      .single();

    if (productError || !product) {
      throw new Error("Product not found");
    }

    if (payment_method === 'pawbucks') {
      // Handle PawBucks payment
      const { data: wallet, error: walletError } = await supabaseClient
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        throw new Error("PawBucks wallet not found");
      }

      if (wallet.balance < product.price_pawbucks) {
        throw new Error("Insufficient PawBucks balance");
      }

      // Deduct PawBucks using service role
      const serviceClient = createClient(
        Deno.env.get("SUPABASE_URL") ?? "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
      );

      const oldBalance = wallet.balance;
      const newBalance = oldBalance - product.price_pawbucks;

      await serviceClient
        .from('pawbucks_wallet')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      // Log activity
      await serviceClient
        .from('pawbucks_activity')
        .insert({
          user_id: user.id,
          type: 'debit',
          source: 'analytics_purchase',
          amount: -product.price_pawbucks,
          description: `Purchased ${product.name}`
        });

      if (product.product_type === 'subscription') {
        // Create subscription
        const endDate = new Date();
        if (product.billing_period === 'monthly') {
          endDate.setMonth(endDate.getMonth() + 1);
        } else if (product.billing_period === 'quarterly') {
          endDate.setMonth(endDate.getMonth() + 3);
        } else if (product.billing_period === 'yearly') {
          endDate.setFullYear(endDate.getFullYear() + 1);
        }

        await serviceClient
          .from('merchant_analytics_subscriptions')
          .insert({
            merchant_id: merchant.id,
            product_id: product.id,
            payment_method: 'pawbucks',
            status: 'active',
            end_date: endDate.toISOString(),
            next_billing_date: endDate.toISOString()
          });
      } else {
        // Create one-time purchase
        await serviceClient
          .from('merchant_analytics_purchases')
          .insert({
            merchant_id: merchant.id,
            product_id: product.id,
            payment_method: 'pawbucks',
            amount_paid: product.price_pawbucks
          });
      }

      return new Response(
        JSON.stringify({ success: true, payment_method: 'pawbucks' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      // Handle USD payment with Stripe
      const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
        apiVersion: "2025-08-27.basil",
      });

      const customers = await stripe.customers.list({ email: user.email, limit: 1 });
      let customerId = customers.data.length > 0 ? customers.data[0].id : undefined;

      if (product.product_type === 'subscription') {
        // Create Stripe subscription checkout
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          customer_email: customerId ? undefined : user.email,
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: product.name,
                description: product.description,
              },
              recurring: {
                interval: product.billing_period === 'monthly' ? 'month' : 
                          product.billing_period === 'quarterly' ? 'month' : 'year',
                interval_count: product.billing_period === 'quarterly' ? 3 : 1,
              },
              unit_amount: Math.round(product.price_usd * 100),
            },
            quantity: 1,
          }],
          mode: 'subscription',
          success_url: `${req.headers.get("origin")}/merchant-dashboard?analytics_success=true`,
          cancel_url: `${req.headers.get("origin")}/merchant-dashboard?analytics_cancelled=true`,
          metadata: {
            merchant_id: merchant.id,
            product_id: product.id,
            product_type: 'analytics_subscription'
          }
        });

        return new Response(
          JSON.stringify({ checkout_url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        // Create one-time payment
        const session = await stripe.checkout.sessions.create({
          customer: customerId,
          customer_email: customerId ? undefined : user.email,
          line_items: [{
            price_data: {
              currency: 'usd',
              product_data: {
                name: product.name,
                description: product.description,
              },
              unit_amount: Math.round(product.price_usd * 100),
            },
            quantity: 1,
          }],
          mode: 'payment',
          success_url: `${req.headers.get("origin")}/merchant-dashboard?analytics_success=true`,
          cancel_url: `${req.headers.get("origin")}/merchant-dashboard?analytics_cancelled=true`,
          metadata: {
            merchant_id: merchant.id,
            product_id: product.id,
            product_type: 'analytics_purchase'
          }
        });

        return new Response(
          JSON.stringify({ checkout_url: session.url }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }
  } catch (error) {
    console.error('Error in merchant-purchase-analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});