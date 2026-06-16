import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { calculateApplicationFee, calculatePawBucksEarned, type FeeModel } from "./fee-logic.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const directChargeSchema = z.object({
  merchantId: z.string().uuid(),
  amount: z.number().min(50).max(99999999), // Min $0.50, max $999,999.99
  description: z.string().optional(),
  metadata: z.record(z.string()).optional(),
});

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-DIRECT-CHARGE] ${step}`, details ? JSON.stringify(details) : "");
};


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
    const parseResult = directChargeSchema.safeParse(body);
    if (!parseResult.success) {
      throw new Error(`Invalid request: ${parseResult.error.message}`);
    }
    const { merchantId, amount, description, metadata } = parseResult.data;
    logStep("Request validated", { merchantId, amount });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get merchant details
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("id", merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    if (!merchant.stripe_account_id) {
      throw new Error("Merchant has not connected their Stripe account");
    }

    if (!merchant.onboarding_complete) {
      throw new Error("Merchant's Stripe account setup is incomplete");
    }

    logStep("Merchant found", { 
      merchantId: merchant.id, 
      stripeAccountId: merchant.stripe_account_id 
    });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Determine fee based on merchant's fee model.
    // See ./fee-logic.ts for rules.
    const feeModel: FeeModel = ((merchant as any).fee_model === 'acquisition_only'
      ? 'acquisition_only'
      : 'full_ecosystem');
    const acquisitionFeeRate: number = Number((merchant as any).acquisition_fee_rate ?? 10);

    let isReturningCustomer = false;
    if (feeModel === 'acquisition_only') {
      const { data: isReturning, error: returningErr } = await supabaseAdmin
        .rpc('is_returning_customer', { p_merchant_id: merchantId, p_user_id: user.id });
      if (returningErr) {
        logStep("WARN: is_returning_customer RPC failed, defaulting to acquisition", { error: returningErr.message });
      }
      isReturningCustomer = Boolean(isReturning);
    }

    const { applicationFee, feePercent, isAcquisition } = calculateApplicationFee({
      amount,
      feeModel,
      acquisitionFeeRate,
      isReturningCustomer,
    });

    // Determine the user's PawBucks earning multiplier from their subscription tier.
    // Free = 10x, PawPass = 20x, PawPass+ = 30x.
    let tierMultiplier = 10;
    let subscriptionTier = 'Free';
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (subscription?.subscription_tier) {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      const stillValid = !expiresAt || expiresAt > new Date();
      if (stillValid) {
        const tier = String(subscription.subscription_tier).toLowerCase();
        if (tier === 'pawpass_plus' || tier === 'plus') {
          tierMultiplier = 30;
          subscriptionTier = 'PawPass+';
        } else if (tier === 'pawpass' || tier === 'basic') {
          tierMultiplier = 20;
          subscriptionTier = 'PawPass';
        }
      }
    }

    // PawBucks earning rules:
    // - full_ecosystem merchants: customer earns on every purchase (tierMultiplier x $).
    // - acquisition_only merchants: customer earns ONLY on their first (acquisition) purchase.
    let pawbucksEarned = calculatePawBucksEarned({
      amount,
      feeModel,
      isReturningCustomer,
      tierMultiplier,
    });

    // Global kill-switch: SuperAdmin can disable PawBucks earning for pet owners platform-wide
    {
      const { data: earnSetting } = await supabaseAdmin
        .from('platform_settings')
        .select('value')
        .eq('key', 'pet_owner_pawbucks_earning_enabled')
        .maybeSingle();
      const v: any = earnSetting?.value;
      const enabled = v == null ? true : (v === true || v === 'true' || v?.enabled === true);
      if (!enabled) {
        logStep('PawBucks earning disabled platform-wide; overriding to 0');
        pawbucksEarned = 0;
      }
    }

    logStep("Fee calculation", { 
      feeModel,
      isAcquisition,
      feePercent,
      amount, 
      applicationFee, 
      pawbucksEarned,
      tierMultiplier,
      subscriptionTier,
      merchantReceives: amount - applicationFee 
    });

    // Create PaymentIntent on the connected account (Direct Charge)
    const paymentIntent = await stripe.paymentIntents.create(
      {
        amount,
        currency: "usd",
        description: description || `Payment to ${merchant.business_name}`,
        application_fee_amount: applicationFee,
        payment_method_types: ["card"],
        metadata: {
          merchant_id: merchantId,
          user_id: user.id,
          user_email: user.email,
          business_name: merchant.business_name,
          pawbucks_earned: String(pawbucksEarned),
          fee_model: feeModel,
          is_acquisition: String(isAcquisition),
          subscription_tier: subscriptionTier,
          tier_multiplier: String(tierMultiplier),
          platform: "pawbucks",
          ...metadata,
        },
      },
      {
        stripeAccount: merchant.stripe_account_id, // Direct Charge: payment created on connected account
      }
    );

    logStep("PaymentIntent created on connected account", { 
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
        amount,
        application_fee: applicationFee,
        currency: "usd",
        status: "pending",
        description: description || `Payment to ${merchant.business_name}`,
        pawbucks_earned: pawbucksEarned,
        metadata: {
          ...metadata,
          business_name: merchant.business_name,
        },
      });

    logStep("Payment record created");

    return new Response(JSON.stringify({
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      connectedAccountId: merchant.stripe_account_id,
      amount,
      applicationFee,
      pawbucksEarned,
      merchantName: merchant.business_name,
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
