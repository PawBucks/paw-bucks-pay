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
    const { redemption_code, offer_id } = body;

    if (!redemption_code) {
      throw new Error("Redemption code required");
    }

    // Look up the redemption in pawbucks_activity (source of truth).
    const { data: activity, error: activityError } = await supabaseClient
      .from("pawbucks_activity")
      .select("id, partner_id, offer_id, redemption_used, user_id, amount")
      .eq("redemption_code", redemption_code)
      .eq("type", "redeem")
      .maybeSingle();

    if (activityError) {
      throw activityError;
    }

    // Codes unlocked via in-store check-in live in `offer_redemptions` and have
    // no pawbucks_activity row. Confirm those here so the deal moves to the
    // pet owner's "Redeemed" pile.
    if (!activity) {
      const { data: unlocked } = await supabaseClient
        .from("offer_redemptions")
        .select("id, offer_id, user_id, redeemed_at, partner_offers!inner(id, partner_id, redemption_count)")
        .eq("redemption_code", redemption_code)
        .eq("partner_offers.partner_id", merchant.id)
        .maybeSingle();

      if (!unlocked) {
        throw new Error("Redemption code not found");
      }
      if (unlocked.redeemed_at) {
        throw new Error("Redemption already confirmed");
      }

      const { data: confirmedUnlock, error: unlockError } = await supabaseClient
        .from("offer_redemptions")
        .update({ redeemed_at: new Date().toISOString(), partner_confirmed: true })
        .eq("id", unlocked.id)
        .is("redeemed_at", null)
        .select()
        .maybeSingle();

      if (unlockError) throw unlockError;
      if (!confirmedUnlock) throw new Error("Redemption already confirmed");

      const currentCount = (unlocked as any).partner_offers?.redemption_count ?? 0;
      await supabaseClient
        .from("partner_offers")
        .update({ redemption_count: currentCount + 1 })
        .eq("id", unlocked.offer_id);

      try {
        await supabaseClient.from("offer_activity").insert({
          offer_id: unlocked.offer_id,
          merchant_id: merchant.id,
          action: "confirmed_redemption",
          actor_id: user.id,
          details: { redemption_code, source: "checkin_unlock" },
        });
      } catch (_) { /* non-fatal */ }

      const [{ data: unlockedProfile }, { data: unlockedOffer }] = await Promise.all([
        supabaseClient.from("profiles").select("full_name, email").eq("id", unlocked.user_id).maybeSingle(),
        supabaseClient.from("partner_offers").select("title").eq("id", unlocked.offer_id).maybeSingle(),
      ]);

      return new Response(
        JSON.stringify({
          success: true,
          redemption: confirmedUnlock,
          offer_title: unlockedOffer?.title ?? null,
          user_name: unlockedProfile?.full_name || "Customer",
          user_email: unlockedProfile?.email ?? null,
          coins_spent: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
      );
    }

    if (!activity) {
      throw new Error("Redemption code not found");
    }

    if (activity.partner_id && activity.partner_id !== merchant.id) {
      throw new Error("This redemption does not belong to your offers");
    }

    if (activity.redemption_used) {
      throw new Error("Redemption already confirmed");
    }

    const { data: confirmed, error: confirmError } = await supabaseClient
      .from("pawbucks_activity")
      .update({ redemption_used: true })
      .eq("id", activity.id)
      .select()
      .single();

    if (confirmError) {
      throw confirmError;
    }

    // Best-effort: increment redemption_count on the offer.
    const targetOfferId = activity.offer_id ?? offer_id ?? null;
    if (targetOfferId) {
      // Keep the pet owner's unlocked card in sync so it moves to "Redeemed".
      await supabaseClient
        .from("offer_redemptions")
        .update({ redeemed_at: new Date().toISOString(), partner_confirmed: true })
        .eq("offer_id", targetOfferId)
        .eq("user_id", activity.user_id)
        .is("redeemed_at", null);

      const { data: offerRow } = await supabaseClient
        .from("partner_offers")
        .select("redemption_count")
        .eq("id", targetOfferId)
        .maybeSingle();
      if (offerRow) {
        await supabaseClient
          .from("partner_offers")
          .update({ redemption_count: (offerRow.redemption_count ?? 0) + 1 })
          .eq("id", targetOfferId);
      }

      // Best-effort activity log; ignore failures (table may not exist in all envs).
      try {
        await supabaseClient.from("offer_activity").insert({
          offer_id: targetOfferId,
          merchant_id: merchant.id,
          action: "confirmed_redemption",
          actor_id: user.id,
          details: { redemption_code, activity_id: activity.id },
        });
      } catch (_) { /* non-fatal */ }
    }

    console.log(`Confirmed redemption ${redemption_code} for merchant ${merchant.id}`);

    const [{ data: activityProfile }, { data: activityOffer }] = await Promise.all([
      supabaseClient.from("profiles").select("full_name, email").eq("id", activity.user_id).maybeSingle(),
      targetOfferId
        ? supabaseClient.from("partner_offers").select("title").eq("id", targetOfferId).maybeSingle()
        : Promise.resolve({ data: null as { title: string } | null }),
    ]);

    return new Response(
      JSON.stringify({
        success: true,
        redemption: confirmed,
        offer_title: activityOffer?.title ?? null,
        user_name: activityProfile?.full_name || "Customer",
        user_email: activityProfile?.email ?? null,
        coins_spent: Math.abs(activity.amount ?? 0),
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
