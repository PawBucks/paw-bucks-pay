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
      image_url,
      require_approval
    } = body;

    // Validations
    if (!title || !description || !coins_required) {
      throw new Error("Missing required fields");
    }

    if (coins_required <= 0) {
      throw new Error("Coins required must be greater than 0");
    }

    if (start_date && end_date && new Date(start_date) >= new Date(end_date)) {
      throw new Error("Start date must be before end date");
    }

    if (redemption_cap !== null && redemption_cap < 0) {
      throw new Error("Redemption cap must be >= 0");
    }

    // Determine initial status
    let status = "draft";
    let is_active = false;

    if (require_approval) {
      status = "pending";
    } else if (start_date && new Date(start_date) <= new Date()) {
      status = "active";
      is_active = true;
    } else if (!start_date) {
      status = "active";
      is_active = true;
    }

    // Create offer - convert empty strings to null for optional fields
    const { data: offer, error: offerError } = await supabaseClient
      .from("partner_offers")
      .insert({
        partner_id: merchant.id,
        title,
        description,
        coins_required,
        cash_equivalent: cash_equivalent || null,
        product_id: product_id || null,
        image_url: image_url || null,
        start_date: start_date || null,
        end_date: end_date || null,
        redemption_cap: redemption_cap || null,
        per_user_limit: per_user_limit || 1,
        is_active,
        status,
        require_approval: require_approval || false
      })
      .select()
      .single();

    if (offerError) {
      throw offerError;
    }

    // Log activity
    await supabaseClient.from("offer_activity").insert({
      offer_id: offer.id,
      merchant_id: merchant.id,
      action: "created",
      actor_id: user.id,
      details: { title, coins_required, status }
    });

    console.log(`Created offer ${offer.id} for merchant ${merchant.id}`);

    return new Response(
      JSON.stringify({
        offer_id: offer.id,
        title: offer.title,
        coins_required: offer.coins_required,
        status: offer.status,
        start_date: offer.start_date,
        end_date: offer.end_date,
        redemption_cap: offer.redemption_cap,
        redemption_count: offer.redemption_count
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 201,
      }
    );
  } catch (error) {
    console.error("Error creating offer:", error);
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
