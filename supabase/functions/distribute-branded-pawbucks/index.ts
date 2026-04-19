import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TargetingRules {
  species?: string[];
  breeds?: string[];
  age_min_years?: number;
  age_max_years?: number;
  zip_codes?: string[];
  consumer_tiers?: string[];
  subscription_tiers?: string[];
  min_purchases?: number;
}

async function userMatchesTargeting(
  supabase: ReturnType<typeof createClient>,
  userId: string,
  rules: TargetingRules,
): Promise<boolean> {
  if (!rules || Object.keys(rules).length === 0) return true;

  // Profile-level checks (subscription tier, zip)
  if (rules.subscription_tiers?.length || rules.zip_codes?.length) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("subscription_tier, zip_code")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) return false;
    if (rules.subscription_tiers?.length && !rules.subscription_tiers.includes((profile as any).subscription_tier || "free")) return false;
    if (rules.zip_codes?.length && !rules.zip_codes.includes((profile as any).zip_code || "")) return false;
  }

  // Pet-level checks
  if (rules.species?.length || rules.breeds?.length || rules.age_min_years || rules.age_max_years) {
    const { data: pets } = await supabase
      .from("pet_profiles")
      .select("species, breed, birth_date")
      .eq("user_id", userId);

    const petList = pets || [];
    if (petList.length === 0) return false;

    const matches = petList.some((p: any) => {
      if (rules.species?.length && !rules.species.includes(p.species)) return false;
      if (rules.breeds?.length && p.breed && !rules.breeds.includes(p.breed)) return false;
      if (rules.age_min_years || rules.age_max_years) {
        if (!p.birth_date) return false;
        const ageYears = (Date.now() - new Date(p.birth_date).getTime()) / (365.25 * 24 * 60 * 60 * 1000);
        if (rules.age_min_years && ageYears < rules.age_min_years) return false;
        if (rules.age_max_years && ageYears > rules.age_max_years) return false;
      }
      return true;
    });
    if (!matches) return false;
  }

  // Consumer tier check
  if (rules.consumer_tiers?.length) {
    const { data: tier } = await supabase
      .from("user_tier_status")
      .select("current_tier")
      .eq("user_id", userId)
      .maybeSingle();
    if (!tier || !rules.consumer_tiers.includes((tier as any).current_tier)) return false;
  }

  // Min purchases
  if (rules.min_purchases && rules.min_purchases > 0) {
    const { count } = await supabase
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "completed");
    if ((count || 0) < rules.min_purchases) return false;
  }

  return true;
}

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

    const { data: activeCampaignMerchants, error: campaignError } = await supabase
      .from("brand_campaign_merchants")
      .select(`
        campaign_id,
        brand_campaigns!inner(
          id, name, pawbucks_per_checkin, pawbucks_pool, total_distributed,
          total_checkins, status, daily_spend_cap, targeting_rules,
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
    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (const cm of activeCampaignMerchants) {
      const campaign = (cm as any).brand_campaigns;
      if (campaign.status !== "active") continue;

      const remaining = campaign.pawbucks_pool - campaign.total_distributed;
      if (remaining < campaign.pawbucks_per_checkin) {
        console.log(`Campaign ${campaign.id} pool exhausted`);
        continue;
      }

      // Daily cap enforcement
      if (campaign.daily_spend_cap && Number(campaign.daily_spend_cap) > 0) {
        const { data: todayStats } = await supabase
          .from("brand_campaign_daily_stats")
          .select("pawbucks_distributed")
          .eq("campaign_id", campaign.id)
          .eq("date", today.toISOString().slice(0, 10))
          .maybeSingle();
        const todayPB = Number(todayStats?.pawbucks_distributed ?? 0);
        const capPB = Number(campaign.daily_spend_cap) * 1000;
        if (todayPB + campaign.pawbucks_per_checkin > capPB) {
          console.log(`Campaign ${campaign.id} daily cap reached`);
          continue;
        }
      }

      // Targeting enforcement
      const rules = (campaign.targeting_rules || {}) as TargetingRules;
      const matches = await userMatchesTargeting(supabase, user_id, rules);
      if (!matches) {
        console.log(`User ${user_id} does not match targeting for campaign ${campaign.id}`);
        continue;
      }

      // Once-per-day per campaign per merchant
      const { data: existingToday } = await supabase
        .from("branded_pawbucks_activity")
        .select("id")
        .eq("campaign_id", campaign.id)
        .eq("user_id", user_id)
        .eq("merchant_id", merchant_id)
        .eq("type", "earn")
        .gte("created_at", today.toISOString())
        .limit(1);

      if (existingToday && existingToday.length > 0) continue;

      const amount = campaign.pawbucks_per_checkin;
      const brandName = campaign.brand_accounts?.brand_name || "Brand";

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

      await supabase
        .from("brand_campaigns")
        .update({
          total_distributed: campaign.total_distributed + amount,
          total_checkins: (campaign.total_checkins || 0) + 1,
        })
        .eq("id", campaign.id);

      results.push({
        campaign_name: campaign.name,
        brand_name: brandName,
        amount,
        brand_logo: campaign.brand_accounts?.logo_url,
      });
    }

    if (results.length > 0) {
      const totalAmount = results.reduce((sum: number, r: any) => sum + r.amount, 0);
      const brandNames = results.map((r: any) => r.brand_name).join(", ");
      await supabase.from("notifications").insert({
        user_id,
        title: "🎁 Branded PawBucks Received!",
        message: `You earned ${totalAmount.toLocaleString()} branded PawBucks from ${brandNames}! Redeem them at participating merchants.`,
        category: "promotional",
      });
    }

    return new Response(
      JSON.stringify({
        distributed: results.length > 0,
        campaigns: results,
        total_amount: results.reduce((s: number, r: any) => s + r.amount, 0),
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
