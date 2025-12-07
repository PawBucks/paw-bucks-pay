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

    // Check if user has active subscription (determines multiplier)
    // Free: 10x, PawPass: 20x, PawPass+: 30x
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription;
    // Simplified: 10x for free, 20x for subscribers (actual tier check done in stripe-webhook)
    const pawbucksMultiplier = hasActiveSubscription ? 20 : 10;
    const pawbucksEarned = Math.round(totalAmount * pawbucksMultiplier);

    console.log('Creating pet store payment:', {
      itemId,
      itemName: item.name,
      quantity,
      totalAmount,
      pawbucksMultiplier,
      pawbucksEarned,
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
        pawbucks_earned: pawbucksEarned.toString(),
        pawbucks_multiplier: pawbucksMultiplier.toString(),
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        pawbucksEarned,
        pawbucksMultiplier,
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
