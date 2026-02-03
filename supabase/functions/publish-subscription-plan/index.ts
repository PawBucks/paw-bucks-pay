import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PUBLISH-SUBSCRIPTION-PLAN] ${step}`, details ? JSON.stringify(details) : "");
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

    // Authenticate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { planId } = await req.json();
    if (!planId) throw new Error("planId is required");
    logStep("Request parsed", { planId });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Get the plan
    const { data: plan, error: planError } = await supabaseAdmin
      .from("merchant_subscription_plans")
      .select("*, merchants(id, stripe_account_id, business_name)")
      .eq("id", planId)
      .single();

    if (planError || !plan) {
      throw new Error("Subscription plan not found");
    }

    // Verify ownership
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, stripe_account_id, user_id")
      .eq("id", plan.merchant_id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    if (merchant.user_id !== user.id) {
      throw new Error("Not authorized to publish this plan");
    }

    if (!merchant.stripe_account_id) {
      throw new Error("Merchant has not connected their Stripe account");
    }

    const connectedAccountId = merchant.stripe_account_id;
    logStep("Merchant verified", { merchantId: merchant.id, connectedAccountId });

    // Verify connected account is active
    const account = await stripe.accounts.retrieve(connectedAccountId);
    if (!account.charges_enabled) {
      throw new Error("Merchant's payment account is not active");
    }

    let stripeProductId = plan.stripe_product_id;
    let stripePriceId = plan.stripe_price_id;

    // Create or update Stripe product on connected account
    if (!stripeProductId) {
      const product = await stripe.products.create(
        {
          name: plan.name,
          description: plan.description || undefined,
          metadata: {
            plan_id: planId,
            platform: "pawbucks",
          },
        },
        { stripeAccount: connectedAccountId }
      );
      stripeProductId = product.id;
      logStep("Stripe product created", { productId: stripeProductId });
    } else {
      // Update existing product
      await stripe.products.update(
        stripeProductId,
        {
          name: plan.name,
          description: plan.description || undefined,
        },
        { stripeAccount: connectedAccountId }
      );
      logStep("Stripe product updated", { productId: stripeProductId });
    }

    // Create new price (prices are immutable in Stripe)
    // If there's an existing price with different amount/interval, archive it
    if (stripePriceId) {
      try {
        await stripe.prices.update(
          stripePriceId,
          { active: false },
          { stripeAccount: connectedAccountId }
        );
        logStep("Previous price archived", { priceId: stripePriceId });
      } catch (e) {
        logStep("Could not archive previous price", { error: String(e) });
      }
    }

    // Create new price on connected account
    const price = await stripe.prices.create(
      {
        product: stripeProductId,
        unit_amount: plan.amount,
        currency: plan.currency,
        recurring: {
          interval: plan.billing_interval as Stripe.PriceCreateParams.Recurring.Interval,
          interval_count: plan.billing_interval_count,
        },
        metadata: {
          plan_id: planId,
          platform: "pawbucks",
        },
      },
      { stripeAccount: connectedAccountId }
    );
    stripePriceId = price.id;
    logStep("Stripe price created", { priceId: stripePriceId });

    // Update the plan with Stripe IDs
    const { error: updateError } = await supabaseAdmin
      .from("merchant_subscription_plans")
      .update({
        stripe_product_id: stripeProductId,
        stripe_price_id: stripePriceId,
        is_active: true,
      })
      .eq("id", planId);

    if (updateError) {
      throw new Error("Failed to update plan with Stripe IDs");
    }

    logStep("Plan published successfully", { planId, stripeProductId, stripePriceId });

    return new Response(JSON.stringify({
      success: true,
      stripeProductId,
      stripePriceId,
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
