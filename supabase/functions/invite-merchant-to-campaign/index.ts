// Brand sends an invitation to a merchant to join a campaign.
// Verifies the brand owns the campaign, creates the invitation, notifies the merchant.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { campaign_id, merchant_ids, message } = await req.json();
    if (!campaign_id || !Array.isArray(merchant_ids) || merchant_ids.length === 0) {
      throw new Error("campaign_id and merchant_ids[] required");
    }

    const admin = createClient(supabaseUrl, serviceKey);

    // Verify brand ownership of campaign
    const { data: campaign, error: campErr } = await admin
      .from("brand_campaigns")
      .select("id, name, brand_id, brand_accounts!inner(id, user_id, brand_name)")
      .eq("id", campaign_id)
      .single();
    if (campErr || !campaign) throw new Error("Campaign not found");
    if ((campaign.brand_accounts as any).user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const brandName = (campaign.brand_accounts as any).brand_name;
    const results: { merchant_id: string; status: string; error?: string }[] = [];

    for (const merchantId of merchant_ids) {
      // Skip if invitation already pending/accepted, or merchant already enrolled
      const { data: existingInv } = await admin
        .from("brand_campaign_invitations")
        .select("id, status")
        .eq("campaign_id", campaign_id)
        .eq("merchant_id", merchantId)
        .maybeSingle();

      if (existingInv && ["pending", "sent", "accepted"].includes(existingInv.status)) {
        results.push({ merchant_id: merchantId, status: "skipped_existing" });
        continue;
      }

      const { data: existingEnrollment } = await admin
        .from("brand_campaign_merchants")
        .select("id")
        .eq("campaign_id", campaign_id)
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (existingEnrollment) {
        results.push({ merchant_id: merchantId, status: "already_enrolled" });
        continue;
      }

      const { error: insertErr } = await admin.from("brand_campaign_invitations").insert({
        campaign_id,
        merchant_id: merchantId,
        message: message || null,
        status: "pending",
      });

      if (insertErr) {
        results.push({ merchant_id: merchantId, status: "error", error: insertErr.message });
        continue;
      }

      // Notify merchant owner
      const { data: merchant } = await admin
        .from("merchants")
        .select("user_id, business_name")
        .eq("id", merchantId)
        .single();
      if (merchant?.user_id) {
        await admin.from("notifications").insert({
          user_id: merchant.user_id,
          title: "📩 Brand Campaign Invitation",
          message: `${brandName} invited "${merchant.business_name}" to join the "${campaign.name}" campaign. Review and accept in your Brand Campaigns inbox.`,
          category: "transactional",
          link_url: "/merchant-dashboard?tab=brand-campaigns",
        });
      }

      results.push({ merchant_id: merchantId, status: "invited" });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("invite-merchant-to-campaign error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
