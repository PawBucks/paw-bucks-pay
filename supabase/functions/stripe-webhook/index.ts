import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // Verify webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    let event;

    if (webhookSecret) {
      try {
        event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
      } catch (err) {
        console.error('Webhook signature verification failed:', err.message);
        return new Response(
          JSON.stringify({ error: 'Webhook signature verification failed' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
      }
    } else {
      event = JSON.parse(body);
    }

    console.log('Stripe webhook event:', event.type);

    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object;
      const { merchant_id, user_id, description } = paymentIntent.metadata;

      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount,
        merchant_id,
        user_id,
      });

      // Initialize Supabase client with service role key
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      // Get merchant cashback rate
      const { data: merchant, error: merchantError } = await supabaseAdmin
        .from('merchants')
        .select('cashback_rate')
        .eq('id', merchant_id)
        .single();

      if (merchantError) {
        console.error('Error fetching merchant:', merchantError);
        throw merchantError;
      }

      const amount = paymentIntent.amount / 100; // Convert from cents
      const cashbackRate = merchant.cashback_rate || 5.0;
      const cashbackAmount = (amount * cashbackRate) / 100;
      const rewardsEarned = Math.floor(amount); // 1 point per dollar

      console.log('Calculated cashback:', {
        amount,
        cashbackRate,
        cashbackAmount,
        rewardsEarned,
      });

      // Create transaction record
      const { error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          pet_owner_id: user_id,
          merchant_id: merchant_id,
          amount: amount,
          cashback_amount: cashbackAmount,
          rewards_earned: rewardsEarned,
          description: description || 'Stripe payment',
          status: 'completed',
        });

      if (transactionError) {
        console.error('Error creating transaction:', transactionError);
        throw transactionError;
      }

      console.log('Transaction recorded successfully');
    }

    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});