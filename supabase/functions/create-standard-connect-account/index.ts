import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CREATE-STANDARD-CONNECT] ${step}`, details ? JSON.stringify(details) : "");
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

    // Auth client for user verification
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Admin client for database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found for this user");
    }
    logStep("Merchant found", { merchantId: merchant.id, businessName: merchant.business_name });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Check if already has a Stripe account
    if (merchant.stripe_account_id) {
      logStep("Existing Stripe account found", { accountId: merchant.stripe_account_id });
      
      // Check account status
      try {
        const account = await stripe.accounts.retrieve(merchant.stripe_account_id);
        
        if (account.charges_enabled && account.payouts_enabled) {
          // Account is fully onboarded
          await supabaseAdmin
            .from("merchants")
            .update({ 
              onboarding_complete: true,
              stripe_account_status: "active"
            })
            .eq("id", merchant.id);

          return new Response(JSON.stringify({
            success: true,
            accountId: merchant.stripe_account_id,
            onboardingComplete: true,
            message: "Stripe account already connected and active"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Account exists but needs more onboarding - create new link
        const accountLink = await stripe.accountLinks.create({
          account: merchant.stripe_account_id,
          refresh_url: `${req.headers.get("origin")}/merchant/dashboard?stripe_refresh=true`,
          return_url: `${req.headers.get("origin")}/merchant/dashboard?stripe_return=true`,
          type: "account_onboarding",
        });

        return new Response(JSON.stringify({
          success: true,
          accountId: merchant.stripe_account_id,
          onboardingUrl: accountLink.url,
          onboardingComplete: false
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch (e) {
        logStep("Error retrieving existing account, creating new one", { error: String(e) });
      }
    }

    // Create new Standard Connect account
    logStep("Creating new Standard Connect account");
    const account = await stripe.accounts.create({
      type: "standard",
      email: user.email,
      business_profile: {
        name: merchant.business_name,
        url: merchant.storefront_slug ? `${req.headers.get("origin")}/store/${merchant.storefront_slug}` : undefined,
      },
      metadata: {
        merchant_id: merchant.id,
        user_id: user.id,
      },
    });

    logStep("Stripe account created", { accountId: account.id });

    // Update merchant with Stripe account ID
    await supabaseAdmin
      .from("merchants")
      .update({
        stripe_account_id: account.id,
        stripe_account_status: "pending",
        onboarding_complete: false,
      })
      .eq("id", merchant.id);

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get("origin")}/merchant/dashboard?stripe_refresh=true`,
      return_url: `${req.headers.get("origin")}/merchant/dashboard?stripe_return=true`,
      type: "account_onboarding",
    });

    logStep("Account link created", { url: accountLink.url });

    return new Response(JSON.stringify({
      success: true,
      accountId: account.id,
      onboardingUrl: accountLink.url,
      onboardingComplete: false
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
