import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for market service purchase
const purchaseSchema = z.object({
  serviceId: z.string().min(1, { message: "Service ID is required" }),
  serviceName: z.string().min(1, { message: "Service name is required" }),
  priceUSD: z.number().positive({ message: "Price must be greater than 0" }),
  pricePawBucks: z.number().positive({ message: "PawBucks price must be greater than 0" }),
  payWithPawBucks: z.boolean().default(false), // Full PawBucks or full USD - no split payments
  billingPeriod: z.enum(['one-time', 'monthly', 'quarterly', 'annual']).optional(),
});

// Merchant PawBucks conversion: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PURCHASE-MARKET-SERVICE] ${step}`, details ? JSON.stringify(details) : '');
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

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

    logStep('User authenticated', { userId: user.id });

    const requestBody = await req.json();
    const validation = purchaseSchema.safeParse(requestBody);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { serviceId, serviceName, priceUSD, pricePawBucks, payWithPawBucks, billingPeriod } = validation.data;

    logStep('Validated request', { serviceId, priceUSD, pricePawBucks, payWithPawBucks, billingPeriod });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user is a merchant
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Only merchants can purchase market services');
    }

    logStep('Merchant verified', { merchantId: merchant.id, businessName: merchant.business_name });

    // CASE 1: Full PawBucks payment
    if (payWithPawBucks) {
      logStep('Processing full PawBucks payment', { pricePawBucks });

      // Verify merchant has sufficient balance
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchant.id)
        .single();

      if (walletError || !wallet) {
        throw new Error('Could not retrieve Merchant PawBucks balance');
      }

      if (wallet.balance < pricePawBucks) {
        throw new Error(`Insufficient PawBucks balance. You have ${wallet.balance.toLocaleString()} PawBucks but need ${pricePawBucks.toLocaleString()}.`);
      }

      logStep('Merchant PawBucks balance verified', { balance: wallet.balance, required: pricePawBucks });

      // Deduct PawBucks from merchant wallet
      const newBalance = wallet.balance - pricePawBucks;
      
      const { error: updateError } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq('merchant_id', merchant.id);

      if (updateError) {
        throw new Error('Failed to deduct PawBucks from merchant wallet');
      }

      // Log the PawBucks activity with proper error handling
      const { error: activityError } = await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchant.id,
        amount: -pricePawBucks,
        type: 'spend',
        source: 'market_service_purchase',
        description: `Purchased: ${serviceName}`,
      });

      if (activityError) {
        logStep('Warning: Failed to log PawBucks activity', { error: activityError.message });
      }

      // Calculate expiration date based on billing period
      const expiresAt = billingPeriod === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : billingPeriod === 'quarterly'
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        : billingPeriod === 'annual'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      // Record the purchase
      await supabaseAdmin.from('merchant_service_purchases').insert({
        merchant_id: merchant.id,
        service_id: serviceId,
        amount_paid_pawbucks: pricePawBucks,
        amount_paid_usd: 0,
        status: 'active',
        expires_at: expiresAt,
      });

      logStep('Full PawBucks payment completed', { pawbucksUsed: pricePawBucks, newBalance, expiresAt });

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'pawbucks_only',
          pawbucksUsed: pricePawBucks,
          serviceName,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CASE 2: Full USD payment via Stripe
    logStep('Processing full USD payment via Stripe', { priceUSD });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    const stripeAmountInCents = Math.round(priceUSD * 100);

    // Create PaymentIntent for full USD payment
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        service_id: serviceId,
        service_name: serviceName,
        merchant_id: merchant.id,
        user_id: user.id,
        total_price: priceUSD.toString(),
        billing_period: billingPeriod || 'one-time',
        purchase_type: 'market_service',
      },
    });

    logStep('PaymentIntent created', { 
      paymentIntentId: paymentIntent.id,
      amountUSD: priceUSD,
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: 'stripe_only',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        stripeAmount: priceUSD,
        serviceName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Market service purchase error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
