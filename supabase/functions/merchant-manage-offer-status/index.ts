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
    const { offer_id, action } = body;

    if (!offer_id || !action) {
      throw new Error("Offer ID and action required");
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

    let updates: any = {};
    let actionLog = "";

    switch (action) {
      case "pause":
        if (offer.status === "archived") {
          throw new Error("Cannot pause archived offer");
        }
        updates = { status: "paused", is_active: false };
        actionLog = "paused";
        break;

      case "resume":
        if (offer.status === "archived") {
          throw new Error("Cannot resume archived offer");
        }
        if (offer.end_date && new Date(offer.end_date) < new Date()) {
          throw new Error("Cannot resume expired offer");
        }
        updates = { status: "active", is_active: true };
        actionLog = "resumed";
        break;

      case "archive":
        updates = { status: "archived", is_active: false };
        actionLog = "archived";
        break;

      default:
        throw new Error("Invalid action");
    }

    // Update offer
    const { data: updatedOffer, error: updateError } = await supabaseClient
      .from("partner_offers")
      .update(updates)
      .eq("id", offer_id)
      .eq("partner_id", merchant.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log activity
    await supabaseClient.from("offer_activity").insert({
      offer_id: offer_id,
      merchant_id: merchant.id,
      action: actionLog,
      actor_id: user.id,
      details: { previous_status: offer.status, new_status: updates.status }
    });

    console.log(`${actionLog} offer ${offer_id} for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify({
        success: true,
        offer: updatedOffer
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error managing offer status:", error);
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
