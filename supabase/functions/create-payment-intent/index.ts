import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// Input validation schema
const paymentIntentSchema = z.object({
  amount: z.number()
    .positive({ message: "Amount must be greater than 0" })
    .max(1000000, { message: "Amount cannot exceed $1,000,000" }),
  merchantId: z.string()
    .uuid({ message: "Invalid merchant ID format" }),
  currency: z.string()
    .length(3, { message: "Currency must be 3-letter ISO code" })
    .toLowerCase()
    .optional()
    .default("usd"),
  description: z.string()
    .max(500, { message: "Description must be less than 500 characters" })
    .optional(),
});

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

    const requestBody = await req.json();

    // Validate input
    const validationResult = paymentIntentSchema.safeParse(requestBody);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Invalid input';
      console.error('Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { amount, currency, merchantId, description } = validationResult.data;

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
    console.error('Error creating payment intent:', error);
    // Return generic error to client, log details server-side
    return new Response(
      JSON.stringify({ error: 'Failed to process payment. Please try again.' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
