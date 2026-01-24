import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    // Verify Stripe key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');
    logStep('Stripe key verified');

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('No authorization header, returning unsubscribed state');
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
        trial_end: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    logStep('Authorization header found');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    // If session is invalid/expired, return unsubscribed state gracefully (not an error)
    if (userError || !userData.user?.email) {
      logStep('Invalid or expired session, returning unsubscribed state', { error: userError?.message });
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
        trial_end: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    const user = userData.user;
    logStep('User authenticated', { userId: user.id, email: user.email });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: '2025-08-27.basil' });
    
    // Find customer by email
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep('No customer found, returning unsubscribed state');
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep('Found Stripe customer', { customerId });

    // Check for active subscription
    const subscriptions = await stripe.subscriptions.list({
      customer: customerId,
      status: 'all',
      limit: 1,
    });

    if (subscriptions.data.length === 0) {
      logStep('No subscriptions found');
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const isActive = ['active', 'trialing'].includes(subscription.status);
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const productId = subscription.items.data[0].price.product as string;
    
    logStep('Subscription found', { 
      subscriptionId: subscription.id,
      status: subscription.status,
      endDate: subscriptionEnd,
      productId,
    });

    return new Response(JSON.stringify({
      subscribed: isActive,
      product_id: productId,
      subscription_end: subscriptionEnd,
      status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep('ERROR in check-subscription', { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
