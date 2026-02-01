import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONFIRM-PAYMENT-SUCCESS] ${step}`, details ? JSON.stringify(details) : "");
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

    const { paymentIntentId, connectedAccountId } = await req.json();

    if (!paymentIntentId || !connectedAccountId) {
      throw new Error('Missing paymentIntentId or connectedAccountId');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if we already processed this payment
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingTx) {
      logStep("Payment already processed", { transactionId: existingTx.id });
      return new Response(
        JSON.stringify({ success: true, message: "Already processed", transactionId: existingTx.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Retrieve the PaymentIntent from the connected account to verify it succeeded
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge'] },
      { stripeAccount: connectedAccountId }
    );

    logStep("PaymentIntent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata 
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not succeeded. Status: ${paymentIntent.status}`);
    }

    const metadata = paymentIntent.metadata || {};
    const userId = metadata.user_id;
    const merchantId = metadata.merchant_id;
    const pawbucksAmount = parseInt(metadata.pawbucks_amount || "0", 10);
    const totalAmount = parseFloat(metadata.total_amount || "0");
    const businessName = metadata.business_name || "Merchant";
    const description = metadata.description || `Payment to ${businessName}`;

    // Verify user matches
    if (userId !== user.id) {
      throw new Error('User ID mismatch');
    }

    const amountInDollars = paymentIntent.amount / 100;
    const platformFee = amountInDollars * 0.03; // 3% fee
    const pawbucksUsdValue = pawbucksAmount * 0.001;

    // CRITICAL: Determine PawBucks multiplier based on user's subscription tier
    // Default 10x for Free, 20x for PawPass, 30x for PawPass+
    let pawbucksMultiplier = 10;
    let tierName = 'Free';

    try {
      const { data: platformSub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (platformSub?.stripe_subscription_id) {
        const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
        const productId = platformSubscription.items.data[0]?.price?.product;
        
        if (productId === 'prod_TQyZjYzt9DwoIK') {
          pawbucksMultiplier = 30; // PawPass+
          tierName = 'PawPass+';
        } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
          pawbucksMultiplier = 20; // PawPass
          tierName = 'PawPass';
        }
      }
      logStep("User subscription tier determined", { tierName, pawbucksMultiplier });
    } catch (tierError) {
      logStep("Error determining tier (using default 10x)", { error: String(tierError) });
    }

    // Calculate PawBucks earned based on Stripe amount and user's tier
    const pawbucksEarned = Math.floor(amountInDollars * pawbucksMultiplier);

    // Get user profile for receipt
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Get merchant details for receipt
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('business_name, address')
      .eq('id', merchantId)
      .single();

    // 1. Update direct_payments status
    await supabaseAdmin
      .from("direct_payments")
      .update({ status: "succeeded" })
      .eq("stripe_payment_intent_id", paymentIntentId);

    logStep("Direct payment status updated");

    // 2. Create transaction record
    const { data: transaction, error: txError } = await supabaseAdmin
      .from("transactions")
      .insert({
        user_id: userId,
        merchant_id: merchantId,
        amount: totalAmount > 0 ? totalAmount : amountInDollars,
        stripe_amount: amountInDollars,
        pawbucks_used: pawbucksAmount,
        application_fee: platformFee,
        status: "completed",
        rewards_earned: pawbucksEarned,
        cashback_earned: pawbucksEarned, // Same as rewards_earned
        stripe_payment_intent_id: paymentIntentId,
        description: description,
      })
      .select()
      .single();

    if (txError) {
      logStep("Error creating transaction", { error: txError.message });
      throw new Error("Failed to create transaction record");
    }

    logStep("Transaction record created", { transactionId: transaction.id });

    // 3. Award PawBucks to user
    if (pawbucksEarned > 0) {
      // Log activity with correct type 'earn' (matches what PawBucksWallet.tsx filters for)
      const { error: activityError } = await supabaseAdmin
        .from("pawbucks_activity")
        .insert({
          user_id: userId,
          amount: pawbucksEarned,
          type: "earn", // CRITICAL: Must be 'earn' not 'credit' for wallet activity display
          source: "direct_payment",
          description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from payment to ${businessName}`,
          pawbucks_status: "available",
          partner_id: merchantId,
          transaction_id: transaction.id,
        });

      if (activityError) {
        logStep("Error inserting pawbucks_activity", { error: activityError.message });
      } else {
        logStep("PawBucks activity logged", { amount: pawbucksEarned, type: "earn" });
      }

      // Update wallet balance
      const { data: wallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        const { error: walletError } = await supabaseAdmin
          .from('pawbucks_wallet')
          .update({ balance: wallet.balance + pawbucksEarned })
          .eq('user_id', userId);
        
        if (walletError) {
          logStep("Error updating wallet balance", { error: walletError.message });
        } else {
          logStep("PawBucks wallet updated", { 
            previousBalance: wallet.balance, 
            newBalance: wallet.balance + pawbucksEarned,
            earned: pawbucksEarned 
          });
        }
      } else {
        logStep("Wallet not found for user, creating one", { userId });
        await supabaseAdmin.from('pawbucks_wallet').insert({
          user_id: userId,
          balance: pawbucksEarned,
        });
      }
    }

    // 4. Deduct PawBucks if user used any
    if (pawbucksAmount > 0) {
      // Already logged when payment was created, but ensure deduction
      const { data: userWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (userWallet && userWallet.balance >= pawbucksAmount) {
        await supabaseAdmin
          .from('pawbucks_wallet')
          .update({ balance: userWallet.balance - pawbucksAmount })
          .eq('user_id', userId);

        // Log redemption activity
        await supabaseAdmin.from('pawbucks_activity').insert({
          user_id: userId,
          amount: -pawbucksAmount,
          type: 'redemption',
          source: 'merchant_payment',
          description: `Payment to ${businessName}`,
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

        await supabaseAdmin.from('merchant_pawbucks_activity').insert({
          merchant_id: merchantId,
          type: 'earn',
          amount: pawbucksAmount,
          source: 'Customer Payment',
          customer_user_id: userId,
          description: `Received ${pawbucksAmount} PawBucks from customer`,
        });

        logStep("PawBucks deducted and credited to merchant", { pawbucksAmount });
      }
    }

    // 5. Auto-log platform fee as Tax Vault expense
    if (platformFee > 0 && merchantId) {
      const expenseDate = new Date().toISOString().split('T')[0];
      const taxYear = new Date().getFullYear();

      await supabaseAdmin
        .from("merchant_tax_expenses")
        .insert({
          merchant_id: merchantId,
          category: "platform_fees",
          amount: platformFee,
          description: `Platform/Processing Fee (3%) on $${amountInDollars.toFixed(2)} sale`,
          vendor_name: "PawBucks Platform",
          expense_date: expenseDate,
          tax_year: taxYear,
          is_auto_logged: true,
          source_purchase_id: paymentIntentId,
        });

      logStep("Platform fee auto-logged to Tax Vault");
    }

    // 6. Credit merchant 1% as PawBucks (merchant earnings)
    const merchantEarnings = Math.round(amountInDollars * 10); // 1% = 10 PawBucks per dollar
    if (merchantEarnings > 0 && merchantId) {
      const { data: merchantWallet } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchantId)
        .single();

      const currentBalance = merchantWallet?.balance || 0;
      
      if (merchantWallet) {
        await supabaseAdmin
          .from('merchant_pawbucks_wallet')
          .update({ balance: currentBalance + merchantEarnings })
          .eq('merchant_id', merchantId);
      } else {
        await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
          merchant_id: merchantId,
          balance: merchantEarnings,
        });
      }

      await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchantId,
        type: 'earn',
        amount: merchantEarnings,
        source: 'Sales Commission',
        customer_user_id: userId,
        description: `Earned 1% from $${amountInDollars.toFixed(2)} sale`,
      });

      logStep("Merchant earnings credited", { merchantEarnings });
    }

    // 7. Send receipt email
    const customerEmail = userProfile?.email || user.email;
    if (customerEmail) {
      // Get card details if available
      let cardBrand: string | undefined;
      let cardLast4: string | undefined;

      const latestCharge = paymentIntent.latest_charge;
      if (latestCharge && typeof latestCharge === 'object' && 'payment_method_details' in latestCharge) {
        const charge = latestCharge as Stripe.Charge;
        if (charge.payment_method_details?.card) {
          cardBrand = charge.payment_method_details.card.brand || undefined;
          cardLast4 = charge.payment_method_details.card.last4 || undefined;
        }
      }

      await sendReceiptEmail({
        email: customerEmail,
        customerName: userProfile?.full_name || undefined,
        transactionDate: new Date().toISOString(),
        receiptId: transaction.id,
        merchantName: merchant?.business_name || businessName,
        merchantLocation: merchant?.address || undefined,
        items: [{ name: description, price: totalAmount > 0 ? totalAmount : amountInDollars }],
        subtotal: totalAmount > 0 ? totalAmount : amountInDollars,
        pawbucksApplied: pawbucksUsdValue,
        cardAmount: amountInDollars,
        totalPaid: totalAmount > 0 ? totalAmount : amountInDollars,
        cardBrand,
        cardLast4,
        pawbucksEarned,
      });
    }

    logStep("Payment processing complete", { 
      transactionId: transaction.id,
      pawbucksEarned,
      pawbucksUsed: pawbucksAmount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        pawbucksEarned,
        message: "Payment confirmed and rewards distributed",
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Confirm payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
