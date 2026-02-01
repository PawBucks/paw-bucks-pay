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

// PawBucks conversion for pet owners: 1000 PawBucks = $1.00 (1 PawBuck = $0.001)
const PAWBUCKS_TO_USD = 0.001;
const PLATFORM_FEE_PERCENT = 0.03; // 3% platform fee

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-COMBINED-PAYMENT] ${step}`, details ? JSON.stringify(details) : "");
};

// Helper function to send receipt email
async function sendReceiptEmail(params: {
  email: string;
  customerName?: string;
  transactionDate: string;
  receiptId: string;
  merchantName: string;
  merchantLocation?: string;
  items: { name: string; price: number }[];
  subtotal: number;
  pawbucksApplied: number;
  cardAmount: number;
  totalPaid: number;
  cardBrand?: string;
  cardLast4?: string;
  pawbucksEarned?: number;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      logStep("Skipping receipt email: config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send receipt email:", errorText);
    } else {
      logStep(`Receipt email sent to ${params.email}`);
    }
  } catch (error) {
    console.error("Error sending receipt email:", error);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

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

    logStep("User authenticated", { userId: user.id });

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
      .select('stripe_account_id, cashback_rate, business_name, accepts_pawbucks, onboarding_complete, address')
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

    logStep('Payment breakdown', {
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
      logStep("Processing full PawBucks payment");
      
      // Get current balance and deduct PawBucks safely
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

      // Credit merchant's PawBucks wallet
      const { data: merchantWallet } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchantId)
        .single();

      if (merchantWallet) {
        await supabaseAdmin
          .from('merchant_pawbucks_wallet')
          .update({ balance: merchantWallet.balance + pawbucksAmount })
          .eq('merchant_id', merchantId);
      } else {
        await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
          merchant_id: merchantId,
          balance: pawbucksAmount,
        });
      }

      // Log merchant PawBucks activity
      await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchantId,
        type: 'earn',
        amount: pawbucksAmount,
        source: 'Customer Payment',
        customer_user_id: user.id,
        description: `Received ${pawbucksAmount} PawBucks from customer`,
      });

      // Create transaction record - NO platform fee on PawBucks-only payments
      const { data: transaction } = await supabaseAdmin.from('transactions').insert({
        user_id: user.id,
        merchant_id: merchantId,
        amount: totalAmount,
        stripe_amount: 0,
        pawbucks_used: pawbucksAmount,
        application_fee: 0, // No fee on PawBucks payments
        cashback_earned: 0, // No cashback on PawBucks payments
        rewards_earned: 0,
        description: description || `PawBucks payment to ${merchant.business_name}`,
        status: 'completed',
      }).select().single();

      // Get user profile for receipt email
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('email, full_name')
        .eq('id', user.id)
        .single();

      // Send receipt email for full PawBucks payment
      const customerEmail = userProfile?.email || user.email;
      if (customerEmail) {
        await sendReceiptEmail({
          email: customerEmail,
          customerName: userProfile?.full_name || undefined,
          transactionDate: new Date().toISOString(),
          receiptId: transaction?.id || `PB-${Date.now()}`,
          merchantName: merchant.business_name,
          merchantLocation: merchant.address || undefined,
          items: [{ name: description || 'PawBucks Payment', price: totalAmount }],
          subtotal: totalAmount,
          pawbucksApplied: pawbucksUsdValue,
          cardAmount: 0,
          totalPaid: totalAmount,
          pawbucksEarned: 0,
        });
      }

      logStep("Full PawBucks payment completed", { transactionId: transaction?.id });

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

    if (!merchant.onboarding_complete) {
      throw new Error("Merchant's Stripe account setup is incomplete");
    }

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Get cashback rate based on subscription
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    let cashbackRate = 10;
    let subscriptionTier = 'Free';

    // Check for manual subscription first
    if (subscription?.is_manual_upgrade && subscription?.subscription_tier) {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      if (!expiresAt || expiresAt > new Date()) {
        if (subscription.subscription_tier === 'pawpass_plus') {
          cashbackRate = 30;
          subscriptionTier = 'PawPass+';
        } else if (subscription.subscription_tier === 'pawpass') {
          cashbackRate = 20;
          subscriptionTier = 'PawPass';
        }
      }
    } else if (subscription?.stripe_subscription_id) {
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

    // Calculate amounts - PawBucks earned on Stripe portion only
    const stripeAmountInCents = Math.round(stripeAmount * 100);
    const pawbucksEarned = Math.round(stripeAmount * cashbackRate);
    // Platform fee: 3% on Stripe portion only
    const platformFeeInCents = Math.round(stripeAmount * PLATFORM_FEE_PERCENT * 100);

    logStep('Stripe payment calculation', {
      stripeAmount,
      stripeAmountInCents,
      cashbackRate,
      pawbucksEarned,
      platformFeeInCents,
      subscriptionTier,
      pawbucksToDeduct: pawbucksAmount,
    });

    // ============================================================
    // DIRECT CHARGE: PaymentIntent created ON the connected account
    // ============================================================
    // Benefits:
    // - Stripe processing fees are paid by the merchant (connected account)
    // - Platform (PawBucks) only receives the application_fee_amount
    // - Zero negative balance risk for the platform
    // - Chargebacks are the merchant's responsibility
    // ============================================================
    
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: stripeAmountInCents,
        currency: 'usd',
        application_fee_amount: platformFeeInCents, // 3% platform fee
        automatic_payment_methods: { enabled: true },
        metadata: {
          merchant_id: merchantId,
          user_id: user.id,
          user_email: user.email || '',
          business_name: merchant.business_name,
          description: description || `Payment to ${merchant.business_name}`,
          subscription_tier: subscriptionTier,
          pawbucks_amount: pawbucksAmount.toString(),
          total_amount: totalAmount.toString(),
          pawbucks_earned: String(pawbucksEarned),
          platform: "pawbucks",
          charge_type: "direct",
        },
      },
      {
        stripeAccount: merchant.stripe_account_id, // DIRECT CHARGE: Created on connected account
      }
    );

    logStep('PaymentIntent created (Direct Charge)', { 
      paymentIntentId: paymentIntent.id,
      connectedAccount: merchant.stripe_account_id 
    });

    // Create pending payment record
    await supabaseAdmin
      .from("direct_payments")
      .insert({
        stripe_payment_intent_id: paymentIntent.id,
        connected_account_id: merchant.stripe_account_id,
        merchant_id: merchantId,
        user_id: user.id,
        amount: stripeAmountInCents,
        application_fee: platformFeeInCents,
        currency: "usd",
        status: "pending",
        description: description || `Payment to ${merchant.business_name}`,
        pawbucks_earned: pawbucksEarned,
        metadata: {
          business_name: merchant.business_name,
          charge_type: "direct",
          subscription_tier: subscriptionTier,
          pawbucks_amount: pawbucksAmount,
          total_amount: totalAmount,
        },
      });

    logStep("Payment record created");

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: pawbucksAmount > 0 ? 'combined' : 'stripe_only',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        connectedAccountId: merchant.stripe_account_id, // Frontend needs this for Stripe.js
        stripeAmount,
        pawbucksAmount,
        pawbucksUsdValue,
        pawbucksEarned,
        cashbackRate,
        applicationFee: platformFeeInCents,
        merchantName: merchant.business_name,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    // Log full error details for debugging
    console.error('Combined payment error:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      type: error instanceof Error ? error.constructor.name : typeof error,
    });
    
    // Return helpful error message
    let userMessage = 'Payment processing failed. Please try again.';
    if (error instanceof Error) {
      if (error.message.includes('country') || error.message.includes('location')) {
        userMessage = 'Payment is not available from your current location. Please try again later.';
      } else if (error.message.includes('Merchant') || error.message.includes('merchant') || error.message.includes('PawBucks')) {
        userMessage = error.message;
      }
    }
    
    return new Response(
      JSON.stringify({ error: userMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
