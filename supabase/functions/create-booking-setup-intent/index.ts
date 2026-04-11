import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { merchantId, serviceId } = await req.json();
    if (!merchantId || !serviceId) {
      return new Response(JSON.stringify({ error: "Missing merchantId or serviceId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the merchant's connected Stripe account
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: merchant } = await adminClient
      .from("merchants")
      .select("stripe_account_id")
      .eq("id", merchantId)
      .single();

    if (!merchant?.stripe_account_id) {
      return new Response(JSON.stringify({ error: "Merchant has not set up payment processing" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Check if customer already exists on connected account
    const customers = await stripe.customers.list(
      { email: user.email, limit: 1 },
      { stripeAccount: merchant.stripe_account_id }
    );

    let customerId: string;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create(
        { email: user.email, metadata: { user_id: user.id } },
        { stripeAccount: merchant.stripe_account_id }
      );
      customerId = customer.id;
    }

    // Create SetupIntent on connected account to save card for future charges
    const setupIntent = await stripe.setupIntents.create(
      {
        customer: customerId,
        payment_method_types: ["card"],
        metadata: {
          user_id: user.id,
          merchant_id: merchantId,
          service_id: serviceId,
          type: "booking_deposit",
        },
      },
      { stripeAccount: merchant.stripe_account_id }
    );

    return new Response(
      JSON.stringify({
        clientSecret: setupIntent.client_secret,
        setupIntentId: setupIntent.id,
        connectedAccountId: merchant.stripe_account_id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating setup intent:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
