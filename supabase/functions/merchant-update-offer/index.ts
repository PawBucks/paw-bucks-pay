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

    const url = new URL(req.url);
    const offerId = url.pathname.split("/").pop();

    if (!offerId) {
      throw new Error("Offer ID required");
    }

    // Check if offer exists and belongs to merchant
    const { data: existingOffer, error: checkError } = await supabaseClient
      .from("partner_offers")
      .select("*")
      .eq("id", offerId)
      .eq("partner_id", merchant.id)
      .single();

    if (checkError || !existingOffer) {
      throw new Error("Offer not found");
    }

    // Allow editing archived offers - merchant may want to reactivate them
    // The status change will be handled by the update logic below

    const body = await req.json();
    const {
      title,
      description,
      coins_required,
      cash_equivalent,
      product_id,
      start_date,
      end_date,
      redemption_cap,
      per_user_limit,
      image_url
    } = body;

    // Normalization: convert empty strings to null for nullable fields
    const normalizedProductId = product_id === "" ? null : product_id;
    const normalizedStartDate = start_date === "" ? null : start_date;
    const normalizedEndDate = end_date === "" ? null : end_date;

    // Validations
    if (coins_required !== undefined && coins_required <= 0) {
      throw new Error("Coins required must be greater than 0");
    }

    if (normalizedStartDate && normalizedEndDate && new Date(normalizedStartDate) >= new Date(normalizedEndDate)) {
      throw new Error("Start date must be before end date");
    }

    if (redemption_cap !== undefined && redemption_cap !== null && redemption_cap < 0) {
      throw new Error("Redemption cap must be >= 0");
    }

    // Prepare update object
    const updates: any = { updated_at: new Date().toISOString() };
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (coins_required !== undefined) updates.coins_required = coins_required;
    if (cash_equivalent !== undefined) updates.cash_equivalent = cash_equivalent;
    if (normalizedProductId !== undefined) updates.product_id = normalizedProductId;
    if (normalizedStartDate !== undefined) updates.start_date = normalizedStartDate;
    if (normalizedEndDate !== undefined) updates.end_date = normalizedEndDate;
    if (redemption_cap !== undefined) updates.redemption_cap = redemption_cap;
    if (per_user_limit !== undefined) updates.per_user_limit = per_user_limit;
    if (image_url !== undefined) updates.image_url = image_url;

    // Update status if start_date changed
    if (start_date && new Date(start_date) > new Date()) {
      updates.status = "draft";
      updates.is_active = false;
    }

    // Update offer
    const { data: offer, error: updateError } = await supabaseClient
      .from("partner_offers")
      .update(updates)
      .eq("id", offerId)
      .eq("partner_id", merchant.id)
      .select()
      .single();

    if (updateError) {
      throw updateError;
    }

    // Log activity
    await supabaseClient.from("offer_activity").insert({
      offer_id: offerId,
      merchant_id: merchant.id,
      action: "updated",
      actor_id: user.id,
      details: { changes: updates }
    });

    console.log(`Updated offer ${offerId} for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify(offer),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error updating offer:", error);
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
