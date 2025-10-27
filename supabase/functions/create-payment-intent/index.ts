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
    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Get authenticated user
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

    const { amount, currency = 'usd', merchantId, description } = await req.json();

    if (!amount || !merchantId) {
      throw new Error('Missing required fields: amount, merchantId');
    }

    console.log('Creating payment intent:', { amount, merchantId, userId: user.id, description });

    // Get merchant details including Stripe Connect account
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id, cashback_rate, business_name')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    if (!merchant.stripe_account_id) {
      throw new Error('Merchant has not completed Stripe Connect setup');
    }

    // Calculate amounts
    const amountInCents = Math.round(amount * 100);
    const cashbackRate = merchant.cashback_rate || 5.0;
    const cashbackAmount = (amount * cashbackRate) / 100;
    const platformFeeInCents = Math.round(cashbackAmount * 100); // Platform keeps the cashback amount

    console.log('Payment breakdown:', {
      totalAmount: amount,
      cashbackRate,
      cashbackAmount,
      platformFee: platformFeeInCents / 100,
      merchantReceives: (amountInCents - platformFeeInCents) / 100,
    });

    // Create a PaymentIntent with Stripe Connect
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency,
      automatic_payment_methods: {
        enabled: true,
      },
      application_fee_amount: platformFeeInCents, // Platform fee (used for cashback)
      transfer_data: {
        destination: merchant.stripe_account_id, // Send to merchant's Connect account
      },
      metadata: {
        merchant_id: merchantId,
        user_id: user.id,
        description: description || `Payment to ${merchant.business_name}`,
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
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating payment intent:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
