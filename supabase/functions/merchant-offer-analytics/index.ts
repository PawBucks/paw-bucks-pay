import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseClient
      .from("merchants")
      .select("id, business_name")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    // Get all offers for merchant
    const { data: offers, error: offersError } = await supabaseClient
      .from("partner_offers")
      .select("id, title, coins_required, redemption_count, status, created_at")
      .eq("partner_id", merchant.id)
      .order("redemption_count", { ascending: false });

    if (offersError) {
      throw offersError;
    }

    // Get total redemptions
    const { count: totalRedemptions } = await supabaseClient
      .from("offer_redemptions")
      .select("*", { count: "exact", head: true })
      .in("offer_id", offers?.map(o => o.id) || []);

    // Get confirmed redemptions
    const { count: confirmedRedemptions } = await supabaseClient
      .from("offer_redemptions")
      .select("*", { count: "exact", head: true })
      .in("offer_id", offers?.map(o => o.id) || [])
      .eq("partner_confirmed", true);

    // Get monthly redemptions (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: monthlyRedemptions, error: monthlyError } = await supabaseClient
      .from("offer_redemptions")
      .select("created_at, offer_id")
      .in("offer_id", offers?.map(o => o.id) || [])
      .gte("created_at", thirtyDaysAgo.toISOString());

    if (monthlyError) {
      throw monthlyError;
    }

    // Group by day
    const redemptionsByDay: Record<string, number> = {};
    monthlyRedemptions?.forEach(r => {
      const day = new Date(r.created_at).toISOString().split("T")[0];
      redemptionsByDay[day] = (redemptionsByDay[day] || 0) + 1;
    });

    // Top performing offers
    const topOffers = offers?.slice(0, 5).map(o => ({
      id: o.id,
      title: o.title,
      redemption_count: o.redemption_count,
      coins_required: o.coins_required,
      status: o.status
    }));

    console.log(`Retrieved analytics for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify({
        total_offers: offers?.length || 0,
        active_offers: offers?.filter(o => o.status === "active").length || 0,
        total_redemptions: totalRedemptions || 0,
        confirmed_redemptions: confirmedRedemptions || 0,
        conversion_rate: totalRedemptions ? ((confirmedRedemptions || 0) / totalRedemptions * 100).toFixed(2) : "0.00",
        monthly_redemptions: redemptionsByDay,
        top_offers: topOffers,
        merchant_name: merchant.business_name
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error getting analytics:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
