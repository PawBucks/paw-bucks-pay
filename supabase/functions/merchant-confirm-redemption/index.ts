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
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    const body = await req.json();
    const { redemption_code, offer_id } = body;

    if (!redemption_code) {
      throw new Error("Redemption code required");
    }

    // Find redemption
    const { data: redemption, error: redemptionError } = await supabaseClient
      .from("offer_redemptions")
      .select("*, partner_offers!inner(*)")
      .eq("redemption_code", redemption_code)
      .single();

    if (redemptionError || !redemption) {
      throw new Error("Redemption code not found");
    }

    // Verify this offer belongs to the merchant
    if (redemption.partner_offers.partner_id !== merchant.id) {
      throw new Error("This redemption does not belong to your offers");
    }

    // Check if already confirmed
    if (redemption.partner_confirmed) {
      throw new Error("Redemption already confirmed");
    }

    // Confirm redemption
    const { data: confirmed, error: confirmError } = await supabaseClient
      .from("offer_redemptions")
      .update({
        partner_confirmed: true,
        redeemed_at: new Date().toISOString()
      })
      .eq("id", redemption.id)
      .select()
      .single();

    if (confirmError) {
      throw confirmError;
    }

    // Increment redemption count
    await supabaseClient
      .from("partner_offers")
      .update({
        redemption_count: redemption.partner_offers.redemption_count + 1
      })
      .eq("id", redemption.offer_id);

    // Log activity
    await supabaseClient.from("offer_activity").insert({
      offer_id: redemption.offer_id,
      merchant_id: merchant.id,
      action: "confirmed_redemption",
      actor_id: user.id,
      details: { redemption_code, redemption_id: redemption.id }
    });

    console.log(`Confirmed redemption ${redemption_code} for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        redemption: confirmed
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error confirming redemption:", error);
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
