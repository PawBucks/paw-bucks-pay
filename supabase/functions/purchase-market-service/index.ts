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
  pawbucksToUse: z.number().min(0).default(0),
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

    const { serviceId, serviceName, priceUSD, pricePawBucks, pawbucksToUse, billingPeriod } = validation.data;

    logStep('Validated request', { serviceId, priceUSD, pawbucksToUse, billingPeriod });

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

    // Calculate payment amounts
    const pawbucksUsdValue = pawbucksToUse * PAWBUCKS_TO_USD;
    const stripeAmount = Math.max(0, priceUSD - pawbucksUsdValue);

    logStep('Payment breakdown', {
      priceUSD,
      pawbucksToUse,
      pawbucksUsdValue,
      stripeAmount,
    });

    // If using PawBucks, verify merchant has sufficient balance
    if (pawbucksToUse > 0) {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        throw new Error('Could not retrieve PawBucks balance');
      }

      if (wallet.balance < pawbucksToUse) {
        throw new Error(`Insufficient PawBucks balance. You have ${wallet.balance} PawBucks.`);
      }

      logStep('PawBucks balance verified', { balance: wallet.balance, required: pawbucksToUse });
    }

    // CASE 1: Full PawBucks payment (no Stripe needed)
    if (stripeAmount <= 0) {
      logStep('Processing full PawBucks payment');

      // Get current balance and deduct
      const { data: currentWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const newBalance = (currentWallet?.balance || 0) - pawbucksToUse;
      
      const { error: updateError } = await supabaseAdmin
        .from('pawbucks_wallet')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      if (updateError) {
        throw new Error('Failed to deduct PawBucks');
      }

      // Log the PawBucks activity
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: user.id,
        amount: -pawbucksToUse,
        type: 'redemption',
        source: 'market_service_purchase',
        description: `Purchased: ${serviceName}`,
      });

      // Record the purchase
      await supabaseAdmin.from('merchant_analytics_purchases').insert({
        merchant_id: merchant.id,
        product_id: serviceId,
        amount_paid: priceUSD,
        payment_method: 'pawbucks',
      });

      logStep('Full PawBucks payment completed', { pawbucksUsed: pawbucksToUse });

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'pawbucks_only',
          pawbucksUsed: pawbucksToUse,
          serviceName,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CASE 2 & 3: Stripe payment (full or partial with PawBucks)
    logStep('Processing Stripe payment');

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    const stripeAmountInCents = Math.round(stripeAmount * 100);
    // Platform fee: 3% of transaction for PawBucks platform
    const platformFeeInCents = Math.round(stripeAmount * 0.03 * 100);

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFeeInCents,
      metadata: {
        service_id: serviceId,
        service_name: serviceName,
        merchant_id: merchant.id,
        user_id: user.id,
        pawbucks_to_deduct: pawbucksToUse.toString(),
        total_price: priceUSD.toString(),
        billing_period: billingPeriod || 'one-time',
        purchase_type: 'market_service',
      },
    });

    logStep('PaymentIntent created', { 
      paymentIntentId: paymentIntent.id,
      stripeAmount,
      pawbucksToDeduct: pawbucksToUse 
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: pawbucksToUse > 0 ? 'combined' : 'stripe_only',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        stripeAmount,
        pawbucksToDeduct: pawbucksToUse,
        pawbucksUsdValue,
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
