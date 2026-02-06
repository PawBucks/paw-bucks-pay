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
      .select("id")
      .eq("id", offerId)
      .eq("partner_id", merchant.id)
      .single();

    if (offerError || !offer) {
      throw new Error("Offer not found");
    }

    // Build query
    let query = supabaseClient
      .from("offer_redemptions")
      .select("*, profiles!inner(full_name, email)", { count: "exact" })
      .eq("offer_id", offerId)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (startDate) {
      query = query.gte("created_at", startDate);
    }

    if (endDate) {
      query = query.lte("created_at", endDate);
    }

    if (status === "confirmed") {
      query = query.eq("partner_confirmed", true);
    } else if (status === "pending") {
      query = query.eq("partner_confirmed", false);
    }

    const { data: redemptions, error: redemptionsError, count } = await query;

    if (redemptionsError) {
      throw redemptionsError;
    }

    console.log(`Listed ${redemptions?.length || 0} redemptions for offer ${offerId}`);

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
