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
    const offerId = url.pathname.split("/").pop();

    if (!offerId) {
      throw new Error("Offer ID required");
    }

    // Get offer
    const { data: offer, error: offerError } = await supabaseClient
      .from("partner_offers")
      .select("*")
      .eq("id", offerId)
      .eq("partner_id", merchant.id)
      .single();

    if (offerError || !offer) {
      throw new Error("Offer not found");
    }

    // Get redemptions count by user
    const { data: redemptions, error: redemptionsError } = await supabaseClient
      .from("offer_redemptions")
      .select("user_id, created_at, partner_confirmed")
      .eq("offer_id", offerId)
      .order("created_at", { ascending: false })
      .limit(10);

    console.log(`Retrieved offer ${offerId} for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify({
        ...offer,
        recent_redemptions: redemptions || []
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error getting offer:", error);
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
