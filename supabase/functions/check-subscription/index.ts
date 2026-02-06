import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CHECK-SUBSCRIPTION] ${step}${detailsStr}`);
};

// Map tier names to product IDs for consistency
const TIER_PRODUCT_MAP = {
  pawpass: 'manual_pawpass',
  pawpass_plus: 'manual_pawpass_plus',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    
    if (!stripeKey) throw new Error('STRIPE_SECRET_KEY is not set');
    logStep('Stripe key verified');

    const supabaseClient = createClient(supabaseUrl, supabaseServiceKey, { 
      auth: { persistSession: false } 
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      logStep('No authorization header, returning unsubscribed state');
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
        trial_end: null,
        is_manual: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    logStep('Authorization header found');

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    
    if (userError || !userData.user?.email) {
      logStep('Invalid or expired session, returning unsubscribed state', { error: userError?.message });
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
        trial_end: null,
        is_manual: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }
    
    const user = userData.user;
    logStep('User authenticated', { userId: user.id, email: user.email });

    // First, check for active manual subscription in database
    const { data: manualSub, error: manualSubError } = await supabaseClient
      .from('subscriptions')
      .select('*')
      .eq('user_id', user.id)
      .eq('is_manual_upgrade', true)
      .eq('status', 'active')
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!manualSubError && manualSub) {
      logStep('Active manual subscription found', { 
        subscriptionId: manualSub.id,
        tier: manualSub.subscription_tier,
        expiresAt: manualSub.expires_at,
      });

      const productId = TIER_PRODUCT_MAP[manualSub.subscription_tier as keyof typeof TIER_PRODUCT_MAP] || null;

      return new Response(JSON.stringify({
        subscribed: true,
        product_id: productId,
        subscription_end: manualSub.expires_at,
        status: 'active',
        trial_end: null,
        is_manual: true,
        subscription_tier: manualSub.subscription_tier,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // No active manual subscription, check Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-12-18.acacia' });
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    if (customers.data.length === 0) {
      logStep('No customer found, returning unsubscribed state');
      return new Response(JSON.stringify({ 
        subscribed: false,
        product_id: null,
        subscription_end: null,
        status: null,
        is_manual: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const customerId = customers.data[0].id;
    logStep('Found Stripe customer', { customerId });

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
        is_manual: false,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const subscription = subscriptions.data[0];
    const isActive = ['active', 'trialing'].includes(subscription.status);
    const subscriptionEnd = new Date(subscription.current_period_end * 1000).toISOString();
    const productId = subscription.items.data[0].price.product as string;
    
    // Fetch product details to determine tier
    let subscriptionTier: string | null = null;
    try {
      const product = await stripe.products.retrieve(productId);
      const productName = product.name?.toLowerCase() || '';
      
      if (productName.includes('plus') || productName.includes('+')) {
        subscriptionTier = 'plus';
      } else if (productName.includes('pawpass') || productName.includes('paw pass')) {
        subscriptionTier = 'basic';
      }
      
      logStep('Product details retrieved', { 
        productId,
        productName: product.name,
        subscriptionTier,
      });
    } catch (productError) {
      logStep('Failed to retrieve product details', { error: productError });
    }
    
    logStep('Stripe subscription found', { 
      subscriptionId: subscription.id,
      status: subscription.status,
      endDate: subscriptionEnd,
      productId,
      subscriptionTier,
    });

    return new Response(JSON.stringify({
      subscribed: isActive,
      product_id: productId,
      subscription_end: subscriptionEnd,
      status: subscription.status,
      trial_end: subscription.trial_end ? new Date(subscription.trial_end * 1000).toISOString() : null,
      is_manual: false,
      subscription_tier: subscriptionTier,
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
