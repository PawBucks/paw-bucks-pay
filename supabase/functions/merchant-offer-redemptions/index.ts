import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    const url = new URL(req.url);
    const offerId = url.pathname.split("/").filter(Boolean).pop();
    const startDate = url.searchParams.get("start_date");
    const endDate = url.searchParams.get("end_date");
    const status = url.searchParams.get("status");
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const offset = (page - 1) * limit;

    if (!offerId) {
      throw new Error("Offer ID required");
    }

    // Verify offer belongs to merchant
    const { data: offer, error: offerError } = await supabaseClient
      .from("partner_offers")
      .select("id, partner_id")
      .eq("id", offerId)
      .eq("partner_id", merchant.id)
      .single();

    if (offerError || !offer) {
      throw new Error("Offer not found");
    }

    // Read redemptions from pawbucks_activity (the actual source of truth
    // populated by the redeem-pawbucks edge function).
    let query = supabaseClient
      .from("pawbucks_activity")
      .select(
        "id, user_id, redemption_code, redemption_used, amount, description, created_at, offer_id, partner_id",
        { count: "exact" }
      )
      .eq("type", "redeem")
      .not("redemption_code", "is", null)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    // Prefer filtering by offer_id (new rows). Fall back to partner_id for
    // legacy rows that were inserted before offer_id existed.
    query = query.or(`offer_id.eq.${offerId},and(offer_id.is.null,partner_id.eq.${offer.partner_id ?? ""})`);

    if (startDate) query = query.gte("created_at", startDate);
    if (endDate) query = query.lte("created_at", endDate);

    if (status === "confirmed") {
      query = query.eq("redemption_used", true);
    } else if (status === "pending") {
      query = query.eq("redemption_used", false);
    }

    const { data: rawRedemptions, error: redemptionsError, count } = await query;

    if (redemptionsError) {
      throw redemptionsError;
    }

    // Hydrate profile info for each user_id in a single follow-up query.
    const userIds = Array.from(new Set((rawRedemptions ?? []).map((r) => r.user_id).filter(Boolean)));
    let profilesById: Record<string, { full_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const redemptions = (rawRedemptions ?? []).map((r) => ({
      id: r.id,
      user_id: r.user_id,
      redemption_code: r.redemption_code,
      partner_confirmed: !!r.redemption_used,
      redeemed_at: r.created_at,
      created_at: r.created_at,
      coins_spent: Math.abs(r.amount ?? 0),
      description: r.description,
      profiles: profilesById[r.user_id] ?? null,
    }));

    console.log(`Listed ${redemptions.length} redemptions for offer ${offerId}`);

    return new Response(
      JSON.stringify({
        redemptions: redemptions || [],
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error listing redemptions:", error);
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
