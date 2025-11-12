import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

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

    const { itemId, quantity } = await req.json();

    if (!itemId || !quantity || quantity <= 0) {
      throw new Error('Invalid item or quantity');
    }

    // Get item details
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: item, error: itemError } = await supabaseAdmin
      .from('pet_store_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      throw new Error('Item not found');
    }

    if (item.stock_quantity < quantity) {
      throw new Error('Not enough stock available');
    }

    const totalAmount = item.price * quantity;
    const amountInCents = totalAmount * 100; // Convert dollars to cents

    // Check if user has active subscription (25% for premium, 10% for free)
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription;
    const cashbackRate = hasActiveSubscription ? 25.0 : 10.0;
    const cashbackAmount = (totalAmount * cashbackRate) / 100;

    console.log('Creating pet store payment:', {
      itemId,
      itemName: item.name,
      quantity,
      totalAmount,
      cashbackRate,
      cashbackAmount,
    });

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        user_id: user.id,
        item_id: itemId,
        item_name: item.name,
        quantity: quantity.toString(),
        source: 'pet_store',
        cashback_amount: cashbackAmount.toFixed(2),
        cashback_rate: cashbackRate.toString(),
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        cashbackAmount,
        cashbackRate,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error creating pet store payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
