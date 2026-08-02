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

    const body = await req.json();
    const { offer_id, count = 1, action } = body;

    if (!offer_id) {
      throw new Error("Offer ID required");
    }

    if (action !== "list" && (count < 1 || count > 1000)) {
      throw new Error("Count must be between 1 and 1000");
    }

    // Check if offer exists and belongs to merchant
    const { data: offer, error: checkError } = await supabaseClient
      .from("partner_offers")
      .select("*")
      .eq("id", offer_id)
      .eq("partner_id", merchant.id)
      .single();

    if (checkError || !offer) {
      throw new Error("Offer not found");
    }

    // Listing mode: return all previously generated codes for this offer.
    if (action === "list") {
      const { data: rows, error: listError } = await supabaseClient
        .from("offer_redemptions")
        .select("redemption_code, user_id, redeemed_at, partner_confirmed, created_at")
        .eq("offer_id", offer_id)
        .order("created_at", { ascending: false });

      if (listError) throw listError;

      return new Response(
        JSON.stringify({
          success: true,
          codes: (rows ?? []).map((r) => r.redemption_code),
          details: (rows ?? []).map((r) => ({
            code: r.redemption_code,
            status: r.redeemed_at
              ? "redeemed"
              : r.user_id
                ? "claimed"
                : "available",
          })),
          count: rows?.length ?? 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    // Generate codes
    const codes = [];
    for (let i = 0; i < count; i++) {
      const { data: codeData } = await supabaseClient.rpc("generate_redemption_code");
      if (codeData) {
        codes.push(codeData);
      }
    }

    // Insert codes (pre-generated, not yet redeemed)
    const redemptions = codes.map(code => ({
      offer_id: offer_id,
      user_id: null, // Unassigned until a customer redeems the code
      redemption_code: code,
      redeemed_at: null,
      partner_confirmed: false
    }));

    const { data: insertedCodes, error: insertError } = await supabaseClient
      .from("offer_redemptions")
      .insert(redemptions)
      .select();

    if (insertError) {
      throw insertError;
    }

    // Log activity
    await supabaseClient.from("offer_activity").insert({
      offer_id: offer_id,
      merchant_id: merchant.id,
      action: "generated_codes",
      actor_id: user.id,
      details: { count, codes }
    });

    console.log(`Generated ${codes.length} codes for offer ${offer_id}`);

    return new Response(
      JSON.stringify({
        success: true,
        codes: codes,
        count: codes.length
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error generating codes:", error);
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
