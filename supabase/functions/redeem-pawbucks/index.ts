import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const redeemSchema = z.object({
  offer_id: z.string().uuid({ message: "Invalid offer ID" }),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create anon client for authentication verification only
    const supabaseAuth = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authentication required" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

    if (userError || !user) {
      console.error("Auth error:", userError);
      return new Response(
        JSON.stringify({ error: "Authentication failed" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 401 }
      );
    }

    // Validate input
    const requestBody = await req.json();
    const validationResult = redeemSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      console.error("Validation failed:", validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid redemption request" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const { offer_id } = validationResult.data;

    // Create service role client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get offer details
    const { data: offer, error: offerError } = await supabaseAdmin
      .from("partner_offers")
      .select("*, merchants(business_name)")
      .eq("id", offer_id)
      .eq("is_active", true)
      .single();

    if (offerError || !offer) {
      console.error("Offer not found:", offerError);
      return new Response(
        JSON.stringify({ error: "Offer not found or no longer available" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Get user's wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from("pawbucks_wallet")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (walletError || !wallet) {
      console.error("Wallet not found for user:", user.id);
      return new Response(
        JSON.stringify({ error: "Wallet not found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 404 }
      );
    }

    // Check if user has enough coins
    if (wallet.balance < offer.coins_required) {
      return new Response(
        JSON.stringify({ 
          error: "Insufficient PawBucks",
          required: offer.coins_required,
          available: wallet.balance
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Generate unique redemption code
    const redemptionCode = `PBK-${Math.random().toString(36).substring(2, 8).toUpperCase()}${Date.now().toString(36).toUpperCase()}`;

    // Deduct coins using service role client
    const { error: updateError } = await supabaseAdmin
      .from("pawbucks_wallet")
      .update({ balance: wallet.balance - offer.coins_required })
      .eq("user_id", user.id);

    if (updateError) {
      console.error("Failed to update wallet balance:", updateError);
      return new Response(
        JSON.stringify({ error: "Unable to process redemption. Please try again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    // Record activity using service role client
    const { error: activityError } = await supabaseAdmin
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
      console.error("Failed to record activity:", activityError);
      // Rollback wallet update
      await supabaseAdmin
        .from("pawbucks_wallet")
        .update({ balance: wallet.balance })
        .eq("user_id", user.id);
      
      return new Response(
        JSON.stringify({ error: "Unable to complete redemption. Please try again." }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
      );
    }

    console.log(`User ${user.id} redeemed ${offer.coins_required} coins for offer ${offer_id}`);

    // Track Branded PawBucks redemption (FIFO across this merchant's active campaigns).
    // Non-fatal: if this fails the offer redemption still stands.
    if (offer.partner_id && offer.coins_required > 0) {
      try {
        const { error: brandedRedeemErr } = await supabaseAdmin.rpc("redeem_branded_pawbucks", {
          p_user_id: user.id,
          p_merchant_id: offer.partner_id,
          p_amount: offer.coins_required,
          p_transaction_id: null,
          p_description: `Branded PawBucks redeemed for offer: ${offer.title}`,
        });
        if (brandedRedeemErr) {
          console.error("Branded redemption tracking failed (non-fatal):", brandedRedeemErr.message);
        }
      } catch (e) {
        console.error("Branded redemption tracking exception (non-fatal):", (e as Error).message);
      }
    }

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
    console.error("Redemption error:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred. Please try again." }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
