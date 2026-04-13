import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { user_id, merchant_id, checkin_id } = await req.json();

    if (!user_id || !merchant_id) {
      return new Response(
        JSON.stringify({ distributed: false, message: "Missing user_id or merchant_id" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Find active campaigns where this merchant participates
    const { data: activeCampaignMerchants, error: campaignError } = await supabase
      .from("brand_campaign_merchants")
      .select(`
        campaign_id,
        brand_campaigns!inner(
          id, name, pawbucks_per_checkin, pawbucks_pool, total_distributed, status,
          brand_accounts!inner(brand_name, logo_url)
        )
      `)
      .eq("merchant_id", merchant_id)
      .eq("status", "active");

    if (campaignError) {
      console.error("Error fetching campaigns:", campaignError);
      return new Response(
        JSON.stringify({ distributed: false, message: "Error checking campaigns" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    if (!activeCampaignMerchants || activeCampaignMerchants.length === 0) {
      return new Response(
        JSON.stringify({ distributed: false, message: "No active brand campaigns at this merchant" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results: any[] = [];

    for (const cm of activeCampaignMerchants) {
      const campaign = cm.brand_campaigns as any;
      
      // Skip if campaign is not active
      if (campaign.status !== "active") continue;

      // Check if pool has remaining budget
      const remaining = campaign.pawbucks_pool - campaign.total_distributed;
      if (remaining < campaign.pawbucks_per_checkin) {
        console.log(`Campaign ${campaign.id} pool exhausted`);
        continue;
      }

      // Check if user already got branded PB from this campaign today (prevent double-dipping)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const { data: existingToday } = await supabase
        .from("branded_pawbucks_activity")
        .select("id")
        .eq("campaign_id", campaign.id)
        .eq("user_id", user_id)
        .eq("merchant_id", merchant_id)
        .eq("type", "earn")
        .gte("created_at", today.toISOString())
        .limit(1);

      if (existingToday && existingToday.length > 0) {
        console.log(`User ${user_id} already received branded PB from campaign ${campaign.id} today`);
        continue;
      }

      const amount = campaign.pawbucks_per_checkin;
      const brandName = campaign.brand_accounts?.brand_name || "Brand";

      // Record the activity
      const { error: activityError } = await supabase
        .from("branded_pawbucks_activity")
        .insert({
          campaign_id: campaign.id,
          user_id,
          type: "earn",
          amount,
          merchant_id,
          checkin_id: checkin_id || null,
          description: `${brandName} campaign check-in reward`,
        });

      if (activityError) {
        console.error("Error recording branded activity:", activityError);
        continue;
      }

      // Upsert ledger balance
      const { data: existingLedger } = await supabase
        .from("branded_pawbucks_ledger")
        .select("id, balance, total_earned")
        .eq("campaign_id", campaign.id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (existingLedger) {
        await supabase
          .from("branded_pawbucks_ledger")
          .update({
            balance: existingLedger.balance + amount,
            total_earned: existingLedger.total_earned + amount,
          })
          .eq("id", existingLedger.id);
      } else {
        await supabase
          .from("branded_pawbucks_ledger")
          .insert({
            campaign_id: campaign.id,
            user_id,
            balance: amount,
            total_earned: amount,
          });
      }

      // Update campaign totals
      await supabase
        .from("brand_campaigns")
        .update({
          total_distributed: campaign.total_distributed + amount,
          total_checkins: (campaign as any).total_checkins ? (campaign as any).total_checkins + 1 : 1,
        })
        .eq("id", campaign.id);

      results.push({
        campaign_name: campaign.name,
        brand_name: brandName,
        amount,
        brand_logo: campaign.brand_accounts?.logo_url,
      });

      console.log(`Distributed ${amount} branded PB from campaign ${campaign.id} to user ${user_id}`);
    }

    // Send notification if any branded PB were distributed
    if (results.length > 0) {
      const totalAmount = results.reduce((sum: number, r: any) => sum + r.amount, 0);
      const brandNames = results.map((r: any) => r.brand_name).join(", ");

      await supabase
        .from("notifications")
        .insert({
          user_id,
          title: "🎁 Branded PawBucks Received!",
          message: `You earned ${totalAmount.toLocaleString()} branded PawBucks from ${brandNames}! These special PawBucks can be redeemed at participating merchants.`,
          category: "promotional",
        });
    }

    return new Response(
      JSON.stringify({
        distributed: results.length > 0,
        campaigns: results,
        total_amount: results.reduce((sum: number, r: any) => sum + r.amount, 0),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error distributing branded PawBucks:", error);
    return new Response(
      JSON.stringify({ distributed: false, message: "Internal error" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
