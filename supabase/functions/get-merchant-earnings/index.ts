import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[GET-MERCHANT-EARNINGS] ${step}`, details ? JSON.stringify(details) : "");
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
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    if (!merchant.stripe_account_id) {
      return new Response(JSON.stringify({
        connected: false,
        message: "No Stripe account connected"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Fetching balance from Stripe", { accountId: merchant.stripe_account_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch balance from connected account using stripeAccount header
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: merchant.stripe_account_id }
    );

    logStep("Balance retrieved", { balance });

    // Fetch recent payouts
    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: merchant.stripe_account_id }
    );

    logStep("Payouts retrieved", { count: payouts.data.length });

    // Fetch recent charges
    const charges = await stripe.charges.list(
      { limit: 20 },
      { stripeAccount: merchant.stripe_account_id }
    );

    logStep("Charges retrieved", { count: charges.data.length });

    // Get payment history from database
    const { data: payments, error: paymentsError } = await supabaseAdmin
      .from("direct_payments")
      .select("*")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (paymentsError) {
      logStep("Error fetching payments", { error: paymentsError.message });
    }

    // Calculate totals from database
    const { data: totals } = await supabaseAdmin
      .from("direct_payments")
      .select("amount, application_fee")
      .eq("merchant_id", merchant.id)
      .eq("status", "succeeded");

    const totalEarnings = totals?.reduce((sum, p) => sum + (p.amount - p.application_fee), 0) || 0;
    const totalFees = totals?.reduce((sum, p) => sum + p.application_fee, 0) || 0;

    // Create Stripe Dashboard login link
    let dashboardUrl = null;
    try {
      const loginLink = await stripe.accounts.createLoginLink(merchant.stripe_account_id);
      dashboardUrl = loginLink.url;
      logStep("Dashboard login link created");
    } catch (e) {
      logStep("Could not create dashboard link", { error: String(e) });
    }

    return new Response(JSON.stringify({
      connected: true,
      accountId: merchant.stripe_account_id,
      balance: {
        available: balance.available,
        pending: balance.pending,
      },
      recentPayouts: payouts.data.map((p: Stripe.Payout) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date,
        created: p.created,
      })),
      recentCharges: charges.data.slice(0, 10).map((c: Stripe.Charge) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        created: c.created,
        description: c.description,
      })),
      payments: payments || [],
      summary: {
        totalEarnings: totalEarnings / 100, // Convert to dollars
        totalFees: totalFees / 100,
        transactionCount: totals?.length || 0,
      },
      dashboardUrl,
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
