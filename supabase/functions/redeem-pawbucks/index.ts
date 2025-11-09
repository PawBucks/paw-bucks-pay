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
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const authHeader = req.headers.get("Authorization")!;
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error("Unauthorized");
    }

    const { offer_id } = await req.json();

    // Get offer details
    const { data: offer, error: offerError } = await supabaseClient
      .from("partner_offers")
      .select("*, merchants(business_name)")
      .eq("id", offer_id)
      .eq("is_active", true)
      .single();

    if (offerError || !offer) {
      throw new Error("Offer not found or inactive");
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabaseClient
      .from("pawbucks_wallet")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error("Wallet not found");
    }

    // Check if user has enough coins
    if (wallet.balance < offer.coins_required) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient PawBucks coins",
          required: offer.coins_required,
          available: wallet.balance
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Generate unique redemption code
    const redemptionCode = `PBK-${Math.random().toString(36).substring(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

    // Start transaction: deduct coins and create activity record
    const { error: updateError } = await supabaseClient
      .from("pawbucks_wallet")
      .update({ balance: wallet.balance - offer.coins_required })
      .eq("user_id", user.id);

    if (updateError) {
      throw new Error("Failed to update wallet balance");
    }

    const { error: activityError } = await supabaseClient
      .from("pawbucks_activity")
      .insert({
        user_id: user.id,
        type: "redeem",
        amount: -offer.coins_required,
        source: "Redemption",
        partner_id: offer.partner_id,
        redemption_code: redemptionCode,
        redemption_used: false,
        description: `Redeemed: ${offer.title}`,
      });

    if (activityError) {
      // Rollback wallet update
      await supabaseClient
        .from("pawbucks_wallet")
        .update({ balance: wallet.balance })
        .eq("user_id", user.id);
      
      throw new Error("Failed to record redemption activity");
    }

    console.log(`User ${user.id} redeemed ${offer.coins_required} coins for ${offer.title}`);

    return new Response(
      JSON.stringify({
        success: true,
        code: redemptionCode,
        partner_name: offer.merchants?.business_name || "Partner",
        offer_title: offer.title,
        coins_spent: offer.coins_required,
        new_balance: wallet.balance - offer.coins_required,
        confirmation_message: `🎉 Success! Show this code at checkout: ${redemptionCode}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Redemption error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
