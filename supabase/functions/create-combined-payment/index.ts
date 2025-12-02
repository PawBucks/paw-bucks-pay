import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for combined payment
const combinedPaymentSchema = z.object({
  totalAmount: z.number().positive({ message: "Amount must be greater than 0" }),
  pawbucksAmount: z.number().min(0).default(0),
  merchantId: z.string().uuid({ message: "Invalid merchant ID" }),
  description: z.string().max(500).optional(),
});

// PawBucks conversion: 10 PawBucks = $1.00
const PAWBUCKS_TO_USD = 0.10;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
    const validation = combinedPaymentSchema.safeParse(requestBody);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { totalAmount, pawbucksAmount, merchantId, description } = validation.data;

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('stripe_account_id, cashback_rate, business_name, accepts_pawbucks')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    // Validate PawBucks usage
    if (pawbucksAmount > 0 && !merchant.accepts_pawbucks) {
      throw new Error('This merchant does not accept PawBucks');
    }

    // Calculate USD value of PawBucks
    const pawbucksUsdValue = pawbucksAmount * PAWBUCKS_TO_USD;
    const stripeAmount = Math.max(0, totalAmount - pawbucksUsdValue);

    console.log('Payment breakdown:', {
      totalAmount,
      pawbucksAmount,
      pawbucksUsdValue,
      stripeAmount,
      merchantAcceptsPawbucks: merchant.accepts_pawbucks,
    });

    // If using PawBucks, verify user has sufficient balance
    if (pawbucksAmount > 0) {
      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      if (walletError || !wallet) {
        throw new Error('Could not retrieve PawBucks balance');
      }

      if (wallet.balance < pawbucksAmount) {
        throw new Error(`Insufficient PawBucks balance. You have ${wallet.balance} PawBucks.`);
      }
    }

    // CASE 1: Full PawBucks payment (no Stripe needed)
    if (stripeAmount <= 0) {
      // Deduct PawBucks
      const { error: deductError } = await supabaseAdmin
        .from('pawbucks_wallet')
        .update({ balance: supabaseAdmin.rpc('balance - ' + pawbucksAmount) })
        .eq('user_id', user.id);

      // Use raw SQL for atomic deduction
      const { error: updateError } = await supabaseAdmin.rpc('raw_sql', {
        query: `UPDATE pawbucks_wallet SET balance = balance - ${pawbucksAmount} WHERE user_id = '${user.id}'`
      });

      // Actually, let's do it properly with a select then update
      const { data: currentWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const newBalance = (currentWallet?.balance || 0) - pawbucksAmount;
      
      await supabaseAdmin
        .from('pawbucks_wallet')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      // Log the PawBucks activity
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: user.id,
        amount: -pawbucksAmount,
        type: 'redemption',
        source: 'merchant_payment',
        description: `Payment to ${merchant.business_name}`,
        partner_id: merchantId,
      });

      // Create transaction record
      const { data: transaction } = await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        merchant_id: merchantId,
        amount: totalAmount,
        cashback_earned: 0, // No cashback on PawBucks payments
        rewards_earned: 0,
        description: description || `PawBucks payment to ${merchant.business_name}`,
        status: 'completed',
      }).select().single();

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'pawbucks_only',
          pawbucksUsed: pawbucksAmount,
          transactionId: transaction?.id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CASE 2 & 3: Stripe payment (full or partial with PawBucks)
    if (!merchant.stripe_account_id) {
      throw new Error('Payment processing is not available for this merchant.');
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Get cashback rate based on subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    let cashbackRate = 10;
    let subscriptionTier = 'Free';

    if (subscription?.stripe_subscription_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const productId = stripeSubscription.items.data[0]?.price?.product;
      
      if (productId === 'prod_TQyZjYzt9DwoIK') {
        cashbackRate = 30;
        subscriptionTier = 'PawPass+';
      } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
        cashbackRate = 20;
        subscriptionTier = 'PawPass';
      }
    }

    // Calculate amounts - cashback only on Stripe portion
    const stripeAmountInCents = Math.round(stripeAmount * 100);
    const cashbackAmount = (stripeAmount * cashbackRate) / 100;
    const platformFeeInCents = Math.round(cashbackAmount * 100);

    console.log('Stripe payment:', {
      stripeAmount,
      stripeAmountInCents,
      cashbackRate,
      cashbackAmount,
      platformFeeInCents,
      subscriptionTier,
      pawbucksToDeduct: pawbucksAmount,
    });

    // Create PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      application_fee_amount: platformFeeInCents,
      transfer_data: { destination: merchant.stripe_account_id },
      metadata: {
        merchant_id: merchantId,
        user_id: user.id,
        description: description || `Payment to ${merchant.business_name}`,
        subscription_tier: subscriptionTier,
        pawbucks_amount: pawbucksAmount.toString(),
        total_amount: totalAmount.toString(),
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: pawbucksAmount > 0 ? 'combined' : 'stripe_only',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        stripeAmount,
        pawbucksAmount,
        pawbucksUsdValue,
        cashbackAmount,
        cashbackRate,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Combined payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});