import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-MERCHANT-SUBSCRIPTION] ${step}`, details ? JSON.stringify(details) : "");
};

// Request validation schema
const subscriptionSchema = z.object({
  merchantId: z.string().uuid(),
  priceId: z.string().min(1), // Price ID on the connected account
  productName: z.string().min(1).max(200),
  paymentMethodId: z.string().min(1), // Card payment method from Stripe Elements
  pawbucksToUse: z.number().int().min(0).optional(), // PawBucks to redeem
  metadata: z.record(z.string()).optional(),
});

const PLATFORM_FEE_PERCENT = 0.03; // 3% platform fee

// PawPass product IDs for tier determination
const PAWPASS_PLUS_PRODUCT_ID = 'prod_TQyZjYzt9DwoIK';
const PAWPASS_PRODUCT_ID = 'prod_TJVK9ZhLiJnnpm';

// Helper function to determine user's subscription tier and multiplier
// Uses dual-verification: checks both subscription_tier field (for manual upgrades)
// and Stripe product IDs (for purchased subscriptions)
async function getUserTierMultiplier(
  supabaseAdmin: any,
  stripe: Stripe,
  userId: string
): Promise<{ multiplier: number; tierName: string }> {
  let pawbucksMultiplier = 10; // Default 10x for Free tier
  let tierName = 'Free';

  try {
    // First, check for active subscription in database (handles both manual and Stripe upgrades)
    const { data: platformSub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade')
      .eq('user_id', userId)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (platformSub) {
      // Check for manual upgrade tier first (takes priority as it's directly set)
      if (platformSub.is_manual_upgrade && platformSub.subscription_tier) {
        const tier = platformSub.subscription_tier.toLowerCase();
        if (tier === 'pawpass_plus' || tier === 'plus') {
          pawbucksMultiplier = 30; // PawPass+
          tierName = 'PawPass+';
          logStep("Manual upgrade tier detected", { tier: platformSub.subscription_tier, multiplier: pawbucksMultiplier });
        } else if (tier === 'pawpass' || tier === 'basic') {
          pawbucksMultiplier = 20; // PawPass
          tierName = 'PawPass';
          logStep("Manual upgrade tier detected", { tier: platformSub.subscription_tier, multiplier: pawbucksMultiplier });
        }
      } 
      // If not a manual upgrade, check Stripe subscription
      else if (platformSub.stripe_subscription_id) {
        const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
        const productId = platformSubscription.items.data[0]?.price?.product;
        
        if (productId === PAWPASS_PLUS_PRODUCT_ID) {
          pawbucksMultiplier = 30; // PawPass+
          tierName = 'PawPass+';
        } else if (productId === PAWPASS_PRODUCT_ID) {
          pawbucksMultiplier = 20; // PawPass
          tierName = 'PawPass';
        }
        logStep("Stripe subscription tier detected", { productId, multiplier: pawbucksMultiplier });
      }
      // Also check subscription_tier field even for non-manual upgrades (fallback)
      else if (platformSub.subscription_tier) {
        const tier = platformSub.subscription_tier.toLowerCase();
        if (tier === 'pawpass_plus' || tier === 'plus') {
          pawbucksMultiplier = 30;
          tierName = 'PawPass+';
        } else if (tier === 'pawpass' || tier === 'basic') {
          pawbucksMultiplier = 20;
          tierName = 'PawPass';
        }
        logStep("Subscription tier field used as fallback", { tier: platformSub.subscription_tier, multiplier: pawbucksMultiplier });
      }
    }
    
    logStep("User subscription tier determined", { userId, tierName, pawbucksMultiplier });
  } catch (tierError) {
    logStep("Error determining tier (using default 10x)", { userId, error: String(tierError) });
  }

  return { multiplier: pawbucksMultiplier, tierName };
}

// Helper function to credit PawBucks to user
async function creditPawBucksToUser(
  supabaseAdmin: any,
  userId: string,
  merchantId: string,
  amountInDollars: number,
  multiplier: number,
  tierName: string,
  productName: string,
  merchantName: string,
  paymentIntentId: string
): Promise<number> {
  const pawbucksEarned = Math.floor(amountInDollars * multiplier);
  
  if (pawbucksEarned <= 0) {
    return 0;
  }

  // Log activity with type 'earn'
  const { error: activityError } = await supabaseAdmin
    .from("pawbucks_activity")
    .insert({
      user_id: userId,
      amount: pawbucksEarned,
      type: "earn",
      source: "subscription_payment",
      description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${multiplier}x) from ${productName} subscription to ${merchantName}`,
      pawbucks_status: "available",
      partner_id: merchantId,
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

  return pawbucksEarned;
}

// Helper function to credit merchant earnings (1%)
async function creditMerchantEarnings(
  supabaseAdmin: any,
  merchantId: string,
  userId: string,
  amountInDollars: number
): Promise<number> {
  const merchantEarnings = Math.round(amountInDollars * 10); // 1% = 10 PawBucks per dollar
  
  if (merchantEarnings <= 0) {
    return 0;
  }

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
    source: 'Subscription Commission',
    customer_user_id: userId,
    description: `Earned 1% from $${amountInDollars.toFixed(2)} subscription payment`,
  });

  logStep("Merchant earnings credited", { merchantEarnings });
  return merchantEarnings;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    // Parse and validate request body
    const body = await req.json();
    const parseResult = subscriptionSchema.safeParse(body);
    if (!parseResult.success) {
      throw new Error(`Invalid request: ${parseResult.error.message}`);
    }
    const { merchantId, priceId, productName, paymentMethodId, pawbucksToUse, metadata } = parseResult.data;
    logStep("Request validated", { merchantId, priceId, productName, pawbucksToUse });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Get merchant details including Stripe Connect account
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, stripe_account_id, onboarding_complete")
      .eq("id", merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    if (!merchant.stripe_account_id) {
      throw new Error("Merchant has not connected their Stripe account");
    }

    const connectedAccountId = merchant.stripe_account_id;
    logStep("Merchant found", { merchantId: merchant.id, connectedAccountId });

    // SAFETY CHECK: Verify connected account is still active and can accept charges
    logStep("Verifying connected account status...");
    const account = await stripe.accounts.retrieve(connectedAccountId);
    
    if (!account.charges_enabled) {
      logStep("Connected account cannot accept charges", { 
        chargesEnabled: account.charges_enabled,
        requirements: account.requirements?.currently_due 
      });
      
      // Update merchant status in our database
      await supabaseAdmin
        .from("merchants")
        .update({ onboarding_complete: false, stripe_account_status: "restricted" })
        .eq("id", merchantId);
      
      throw new Error("Merchant's payment account is not active. They may need to complete verification.");
    }
    logStep("Connected account verified", { 
      chargesEnabled: account.charges_enabled, 
      payoutsEnabled: account.payouts_enabled 
    });

    // Get price details from the connected account
    const price = await stripe.prices.retrieve(priceId, {}, { stripeAccount: connectedAccountId });
    
    if (!price.active) {
      throw new Error("This subscription plan is no longer available");
    }
    
    const amount = price.unit_amount || 0;
    const currency = price.currency;
    const interval = price.recurring?.interval || "month";
    const intervalCount = price.recurring?.interval_count || 1;
    
    logStep("Price retrieved from connected account", { 
      priceId, 
      amount, 
      currency, 
      interval, 
      intervalCount 
    });

    // Create or retrieve customer ON THE CONNECTED ACCOUNT (not platform)
    let connectedCustomer: Stripe.Customer;
    
    // Search for existing customer on connected account by email
    const existingCustomers = await stripe.customers.list(
      { email: user.email, limit: 1 },
      { stripeAccount: connectedAccountId }
    );

    if (existingCustomers.data.length > 0) {
      connectedCustomer = existingCustomers.data[0];
      logStep("Existing customer found on connected account", { customerId: connectedCustomer.id });
    } else {
      // Create new customer on connected account
      connectedCustomer = await stripe.customers.create(
        {
          email: user.email,
          name: user.user_metadata?.full_name || user.email,
          metadata: {
            platform_user_id: user.id,
            source: "pawbucks_platform",
          },
        },
        { stripeAccount: connectedAccountId }
      );
      logStep("New customer created on connected account", { customerId: connectedCustomer.id });
    }

    // Attach payment method to customer on connected account
    await stripe.paymentMethods.attach(
      paymentMethodId,
      { customer: connectedCustomer.id },
      { stripeAccount: connectedAccountId }
    );

    // Set as default payment method
    await stripe.customers.update(
      connectedCustomer.id,
      { invoice_settings: { default_payment_method: paymentMethodId } },
      { stripeAccount: connectedAccountId }
    );
    logStep("Payment method attached to connected customer", { paymentMethodId });

    // Calculate billing dates
    const now = new Date();
    const periodEnd = new Date(now);
    
    switch (interval) {
      case "day":
        periodEnd.setDate(periodEnd.getDate() + intervalCount);
        break;
      case "week":
        periodEnd.setDate(periodEnd.getDate() + (7 * intervalCount));
        break;
      case "month":
        periodEnd.setMonth(periodEnd.getMonth() + intervalCount);
        break;
      case "year":
        periodEnd.setFullYear(periodEnd.getFullYear() + intervalCount);
        break;
    }

    // === PAWBUCKS REDEMPTION LOGIC ===
    const PAWBUCKS_TO_USD = 0.001; // 1000 PawBucks = $1.00
    const MINIMUM_STRIPE_CENTS = 50; // $0.50 minimum for subscriptions
    
    let actualPawbucksUsed = 0;
    let pawbucksDiscountCents = 0;
    let stripeChargeAmount = amount;

    if (pawbucksToUse && pawbucksToUse > 0) {
      // Validate user has sufficient balance
      const { data: wallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const availableBalance = wallet?.balance || 0;
      
      if (pawbucksToUse > availableBalance) {
        throw new Error(`Insufficient PawBucks balance. You have ${availableBalance} but tried to use ${pawbucksToUse}.`);
      }

      // Check merchant accepts PawBucks
      const { data: merchantCheck } = await supabaseAdmin
        .from('merchants')
        .select('accepts_pawbucks')
        .eq('id', merchantId)
        .single();

      if (!merchantCheck?.accepts_pawbucks) {
        throw new Error("This merchant does not accept PawBucks.");
      }

      // Calculate discount (ensure minimum Stripe charge)
      const maxPawbucksDiscountCents = amount - MINIMUM_STRIPE_CENTS;
      const requestedDiscountCents = Math.round(pawbucksToUse * PAWBUCKS_TO_USD * 100);
      pawbucksDiscountCents = Math.min(requestedDiscountCents, maxPawbucksDiscountCents);
      
      // Recalculate actual PawBucks used based on capped discount
      actualPawbucksUsed = Math.floor(pawbucksDiscountCents / PAWBUCKS_TO_USD / 100);
      stripeChargeAmount = amount - pawbucksDiscountCents;

      logStep("PawBucks redemption calculated", {
        requested: pawbucksToUse,
        actualUsed: actualPawbucksUsed,
        discountCents: pawbucksDiscountCents,
        stripeChargeAmount,
      });
    }

    // Calculate application fee (3% platform fee on Stripe portion only)
    const applicationFee = Math.round(stripeChargeAmount * PLATFORM_FEE_PERCENT);
    
    logStep("Creating initial payment", { 
      originalAmount: amount,
      pawbucksDiscount: pawbucksDiscountCents,
      stripeChargeAmount, 
      applicationFee,
      merchantReceives: stripeChargeAmount - applicationFee 
    });

    // Create the first PaymentIntent on the connected account (Direct Charge)
    // Use payment_method_types instead of automatic_payment_methods to avoid redirect requirements
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount: stripeChargeAmount,
        currency,
        customer: connectedCustomer.id,
        payment_method: paymentMethodId,
        payment_method_types: ['card'], // Explicitly only allow card payments (no redirects)
        off_session: false, // First payment is on-session
        confirm: true,
        application_fee_amount: applicationFee,
        description: `${productName} subscription - First payment${actualPawbucksUsed > 0 ? ` (${actualPawbucksUsed} PawBucks applied)` : ''}`,
        metadata: {
          merchant_id: merchantId,
          user_id: user.id,
          business_name: merchant.business_name, // Include for receipt emails
          subscription_type: "merchant_recurring",
          product_name: productName,
          billing_interval: interval,
          platform: "pawbucks",
          pawbucks_used: actualPawbucksUsed.toString(),
          original_amount: amount.toString(),
          description: `${productName} subscription to ${merchant.business_name}`,
          ...metadata,
        },
      },
      { stripeAccount: connectedAccountId }
    );

    logStep("Initial PaymentIntent created", { 
      paymentIntentId: paymentIntent.id,
      status: paymentIntent.status 
    });

    // Check if payment succeeded
    if (paymentIntent.status !== "succeeded") {
      // Payment requires action or failed
      if (paymentIntent.status === "requires_action" || paymentIntent.status === "requires_confirmation") {
        return new Response(JSON.stringify({
          success: false,
          requiresAction: true,
          clientSecret: paymentIntent.client_secret,
          connectedAccountId,
          message: "Payment requires additional authentication",
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      throw new Error(`Payment failed with status: ${paymentIntent.status}`);
    }

    // Payment succeeded - create subscription record
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .insert({
        user_id: user.id,
        stripe_customer_id_on_connected: connectedCustomer.id,
        merchant_id: merchantId,
        connected_account_id: connectedAccountId,
        stripe_price_id: priceId,
        product_name: productName,
        amount,
        currency,
        billing_interval: interval,
        billing_interval_count: intervalCount,
        status: "active",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        next_billing_date: periodEnd.toISOString(),
        last_payment_date: now.toISOString(),
        last_payment_intent_id: paymentIntent.id,
        last_payment_status: "succeeded",
        application_fee_percent: PLATFORM_FEE_PERCENT * 100,
        metadata: metadata || {},
      })
      .select()
      .single();

    if (subError) {
      logStep("Error creating subscription record", { error: subError.message });
      throw new Error("Failed to create subscription record");
    }

    logStep("Subscription created", { subscriptionId: subscription.id });

    // Log subscription event
    await supabaseAdmin.from("merchant_subscription_events").insert({
      subscription_id: subscription.id,
      event_type: "created",
      amount,
      payment_intent_id: paymentIntent.id,
      metadata: {
        product_name: productName,
        billing_interval: interval,
        merchant_name: merchant.business_name,
      },
    });

    // === PAWBUCKS REDEMPTION - DEDUCT FROM USER & CREDIT TO MERCHANT ===
    if (actualPawbucksUsed > 0) {
      // Deduct PawBucks from user's wallet
      const { data: userWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const currentBalance = userWallet?.balance || 0;
      const newBalance = currentBalance - actualPawbucksUsed;

      await supabaseAdmin
        .from('pawbucks_wallet')
        .update({ balance: newBalance })
        .eq('user_id', user.id);

      // Log debit activity
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: user.id,
        amount: -actualPawbucksUsed,
        type: 'redeem',
        source: 'subscription_payment',
        description: `Redeemed ${actualPawbucksUsed} PawBucks for ${productName} subscription at ${merchant.business_name}`,
        pawbucks_status: 'available',
        partner_id: merchantId,
      });

      logStep("PawBucks deducted from user", { 
        previousBalance: currentBalance, 
        deducted: actualPawbucksUsed, 
        newBalance 
      });

      // Credit PawBucks to merchant's wallet
      const { data: merchantWallet } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchantId)
        .single();

      const merchantCurrentBalance = merchantWallet?.balance || 0;
      const merchantNewBalance = merchantCurrentBalance + actualPawbucksUsed;

      if (merchantWallet) {
        await supabaseAdmin
          .from('merchant_pawbucks_wallet')
          .update({ balance: merchantNewBalance })
          .eq('merchant_id', merchantId);
      } else {
        await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
          merchant_id: merchantId,
          balance: actualPawbucksUsed,
        });
      }

      // Log merchant credit activity
      await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchantId,
        type: 'redeem',
        amount: actualPawbucksUsed,
        source: 'Customer Redemption',
        customer_user_id: user.id,
        description: `Customer redeemed ${actualPawbucksUsed} PawBucks for subscription`,
      });

      logStep("PawBucks credited to merchant", { 
        previousBalance: merchantCurrentBalance, 
        credited: actualPawbucksUsed, 
        newBalance: merchantNewBalance 
      });
    }

    // === PAWBUCKS REWARDS PROCESSING (based on Stripe amount only) ===
    const stripeAmountInDollars = stripeChargeAmount / 100;

    // Get user's subscription tier for multiplier
    const { multiplier, tierName } = await getUserTierMultiplier(supabaseAdmin, stripe, user.id);

    // Credit PawBucks to user (rewards based on Stripe portion only)
    const pawbucksEarned = await creditPawBucksToUser(
      supabaseAdmin,
      user.id,
      merchantId,
      stripeAmountInDollars,
      multiplier,
      tierName,
      productName,
      merchant.business_name,
      paymentIntent.id
    );

    // Credit merchant 1% earnings (based on Stripe portion only)
    await creditMerchantEarnings(supabaseAdmin, merchantId, user.id, stripeAmountInDollars);

    // Auto-log platform fee as Tax Vault expense
    if (applicationFee > 0) {
      const expenseDate = new Date().toISOString().split('T')[0];
      const taxYear = new Date().getFullYear();

      await supabaseAdmin
        .from("merchant_tax_expenses")
        .insert({
          merchant_id: merchantId,
          category: "platform_fees",
          amount: applicationFee / 100, // Convert to dollars
          description: `Platform Fee (3%) on $${stripeAmountInDollars.toFixed(2)} subscription payment`,
          vendor_name: "PawBucks Platform",
          expense_date: expenseDate,
          tax_year: taxYear,
          is_auto_logged: true,
          source_purchase_id: paymentIntent.id,
        });

      logStep("Platform fee auto-logged to Tax Vault");
    }

    // Send notification to user
    const pawbucksUsedMsg = actualPawbucksUsed > 0 ? ` Used ${actualPawbucksUsed} PawBucks for $${(pawbucksDiscountCents / 100).toFixed(2)} off.` : '';
    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Subscription Started",
      message: `Your subscription to ${productName} from ${merchant.business_name} is now active.${pawbucksUsedMsg} You earned ${pawbucksEarned} PawBucks!`,
      category: "transactional",
    });

    return new Response(JSON.stringify({
      success: true,
      subscriptionId: subscription.id,
      status: "active",
      nextBillingDate: periodEnd.toISOString(),
      amount: amount / 100, // Return original amount in dollars
      stripeAmount: stripeChargeAmount / 100,
      productName,
      merchantName: merchant.business_name,
      pawbucksEarned,
      pawbucksUsed: actualPawbucksUsed,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
