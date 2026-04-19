import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("Stripe not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify ownership
    const { data: campaign, error: campErr } = await admin
      .from("brand_campaigns")
      .select("*, brand_accounts!inner(id, user_id, brand_name, contact_email)")
      .eq("id", campaign_id)
      .single();

    if (campErr || !campaign) throw new Error("Campaign not found");
    if ((campaign.brand_accounts as any).user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (campaign.status !== "draft" && campaign.status !== "pending_payment") {
      throw new Error(`Campaign cannot be funded in status: ${campaign.status}`);
    }

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const brandEmail = (campaign.brand_accounts as any).contact_email || user.email;

    // Find or create customer
    let customerId = campaign.stripe_customer_id;
    if (!customerId) {
      const list = await stripe.customers.list({ email: brandEmail, limit: 1 });
      customerId = list.data[0]?.id ||
        (await stripe.customers.create({
          email: brandEmail,
          name: (campaign.brand_accounts as any).brand_name,
          metadata: { brand_id: (campaign.brand_accounts as any).id },
        })).id;
    }

    const origin = req.headers.get("origin") || "https://pawbucks.app";

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: {
            name: `Campaign Funding: ${campaign.name}`,
            description: `${Number(campaign.budget_usd).toLocaleString()} USD funding for branded PawBucks campaign`,
          },
          unit_amount: Math.round(Number(campaign.budget_usd) * 100),
        },
        quantity: 1,
      }],
      // Save card for future auto-replenish
      payment_intent_data: {
        setup_future_usage: "off_session",
        metadata: { campaign_id, brand_id: (campaign.brand_accounts as any).id, type: "brand_campaign_funding" },
      },
      success_url: `${origin}/brand-dashboard?funded=${campaign_id}`,
      cancel_url: `${origin}/brand-dashboard?cancelled=${campaign_id}`,
      metadata: { campaign_id, brand_id: (campaign.brand_accounts as any).id },
    });

    await admin.from("brand_campaigns").update({
      status: "pending_payment",
      stripe_customer_id: customerId,
      funding_method: "self_serve",
    }).eq("id", campaign_id);

    return new Response(JSON.stringify({ url: session.url, session_id: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("create-brand-campaign-payment error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
