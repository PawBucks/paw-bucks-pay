import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY")!, { apiVersion: "2025-08-27.basil" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const { data: campaign } = await admin
      .from("brand_campaigns")
      .select("*, brand_accounts!inner(id, user_id, brand_name)")
      .eq("id", campaign_id)
      .single();

    if (!campaign) throw new Error("Campaign not found");

    // If already active, no-op
    if (campaign.status === "active" && campaign.funded_at) {
      return new Response(JSON.stringify({ funded: true, already: true }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Look up most recent successful payment for this campaign via metadata
    const intents = await stripe.paymentIntents.search({
      query: `metadata['campaign_id']:'${campaign_id}' AND status:'succeeded'`,
      limit: 1,
    });

    if (intents.data.length === 0) {
      return new Response(JSON.stringify({ funded: false }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const pi = intents.data[0];

    // Save the payment method for auto-replenish
    if (pi.payment_method && pi.customer) {
      try {
        const pm = await stripe.paymentMethods.retrieve(pi.payment_method as string);
        await admin.from("brand_payment_methods").upsert({
          brand_id: (campaign.brand_accounts as any).id,
          stripe_customer_id: pi.customer as string,
          stripe_payment_method_id: pm.id,
          card_brand: pm.card?.brand || null,
          card_last4: pm.card?.last4 || null,
          card_exp_month: pm.card?.exp_month || null,
          card_exp_year: pm.card?.exp_year || null,
          is_default: true,
        }, { onConflict: "brand_id,stripe_payment_method_id" });
      } catch (e) {
        console.warn("Could not save payment method:", e);
      }
    }

    // Activate the campaign
    await admin.from("brand_campaigns").update({
      status: "active",
      funded_at: new Date().toISOString(),
      stripe_payment_intent_id: pi.id,
      stripe_customer_id: pi.customer as string,
    }).eq("id", campaign_id);

    // Notify brand owner
    if ((campaign.brand_accounts as any).user_id) {
      await admin.from("notifications").insert({
        user_id: (campaign.brand_accounts as any).user_id,
        title: "🚀 Campaign Live!",
        message: `Your campaign "${campaign.name}" has been funded ($${Number(campaign.budget_usd).toLocaleString()}) and is now distributing branded PawBucks.`,
        category: "transactional",
      });
    }

    return new Response(JSON.stringify({ funded: true, payment_intent_id: pi.id }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("verify-brand-campaign-payment error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
