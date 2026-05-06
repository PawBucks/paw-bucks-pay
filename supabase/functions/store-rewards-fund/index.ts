import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Body schema: top up the merchant's Store Rewards Pro funding wallet via Stripe.
// amountCents: USD amount in cents to add. Min $10, max $5,000 per top-up.
const schema = z.object({
  merchantId: z.string().uuid(),
  amountCents: z.number().int().min(1000).max(500000),
});

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[STORE-REWARDS-FUND] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const svc = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supaAuth = createClient(supabaseUrl, anon);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userErr } = await supaAuth.auth.getUser(token);
    if (userErr || !userData.user) throw new Error("Authentication failed");
    const user = userData.user;
    log("user", { id: user.id });

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: parsed.error.errors[0]?.message ?? "Invalid request" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }
    const { merchantId, amountCents } = parsed.data;

    const supa = createClient(supabaseUrl, svc);

    // Verify caller owns the merchant
    const { data: merchant, error: merchantErr } = await supa
      .from("merchants")
      .select("id, user_id, business_name")
      .eq("id", merchantId)
      .maybeSingle();
    if (merchantErr || !merchant) throw new Error("Merchant not found");
    if (merchant.user_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Not authorized for this merchant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 403 },
      );
    }

    // Verify merchant has active Store Rewards Pro
    const { data: hasSrp } = await supa.rpc("merchant_has_store_rewards_pro", {
      p_merchant_id: merchantId,
    });
    if (!hasSrp) {
      return new Response(
        JSON.stringify({ error: "Store Rewards Pro is not active for this merchant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Find or create a Stripe customer for this user (platform-side)
    const customers = await stripe.customers.list({ email: user.email!, limit: 1 });
    const customerId = customers.data[0]?.id ??
      (await stripe.customers.create({ email: user.email!, metadata: { user_id: user.id } })).id;

    // Create a Checkout Session on the platform account
    const origin = req.headers.get("origin") ?? "https://pawbucks.app";
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      customer: customerId,
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `Store Rewards Pro funding — ${merchant.business_name}`,
              description: "Funds your in-store PawBucks rewards wallet",
            },
            unit_amount: amountCents,
          },
          quantity: 1,
        },
      ],
      success_url: `${origin}/merchant/store-rewards?topup=success`,
      cancel_url: `${origin}/merchant/store-rewards?topup=cancel`,
      metadata: {
        purpose: "store_rewards_funding",
        merchant_id: merchantId,
        user_id: user.id,
        amount_cents: String(amountCents),
      },
    });

    log("session created", { id: session.id, amountCents });
    return new Response(JSON.stringify({ url: session.url }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    log("ERROR", { msg });
    return new Response(JSON.stringify({ error: msg }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});