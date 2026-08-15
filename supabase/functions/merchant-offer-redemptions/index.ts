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
      .select("id, partner_id")
      .eq("id", offerId)
      .eq("partner_id", merchant.id)
      .single();

    if (offerError || !offer) {
      throw new Error("Offer not found");
    }

    type Unified = {
      id: string;
      user_id: string | null;
      redemption_code: string;
      partner_confirmed: boolean;
      redeemed_at: string | null;
      created_at: string;
      coins_spent: number;
      description: string | null;
      source: "checkin_unlock" | "pawbucks";
    };

    // Source A: codes unlocked in-store via QR check-in (offer_redemptions).
    // Only rows claimed by a customer count — unassigned pre-generated codes
    // in the merchant's pool are not redemptions.
    let unlockQuery = supabaseClient
      .from("offer_redemptions")
      .select("id, user_id, redemption_code, redeemed_at, partner_confirmed, created_at")
      .eq("offer_id", offerId)
      .not("user_id", "is", null);

    // Source B: PawBucks redemption codes (pawbucks_activity).
    let pbQuery = supabaseClient
      .from("pawbucks_activity")
      .select("id, user_id, redemption_code, redemption_used, amount, description, created_at, offer_id, partner_id")
      .eq("type", "redeem")
      .not("redemption_code", "is", null)
      // Prefer filtering by offer_id (new rows). Fall back to partner_id for
      // legacy rows that were inserted before offer_id existed.
      .or(`offer_id.eq.${offerId},and(offer_id.is.null,partner_id.eq.${offer.partner_id ?? ""})`);

    if (startDate) {
      unlockQuery = unlockQuery.gte("created_at", startDate);
      pbQuery = pbQuery.gte("created_at", startDate);
    }
    if (endDate) {
      unlockQuery = unlockQuery.lte("created_at", endDate);
      pbQuery = pbQuery.lte("created_at", endDate);
    }

    const [{ data: unlockRows, error: unlockError }, { data: pbRows, error: pbError }] =
      await Promise.all([unlockQuery, pbQuery]);

    if (unlockError) throw unlockError;
    if (pbError) throw pbError;

    const unified: Unified[] = [
      ...((unlockRows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        user_id: r.user_id as string | null,
        redemption_code: r.redemption_code as string,
        partner_confirmed: !!r.redeemed_at,
        redeemed_at: (r.redeemed_at as string | null) ?? null,
        created_at: r.created_at as string,
        coins_spent: 0,
        description: null,
        source: "checkin_unlock" as const,
      })),
      ...((pbRows ?? []) as any[]).map((r) => ({
        id: r.id as string,
        user_id: r.user_id as string | null,
        redemption_code: r.redemption_code as string,
        partner_confirmed: !!r.redemption_used,
        // A PawBucks code is only "redeemed" once the merchant confirms it.
        redeemed_at: r.redemption_used ? (r.created_at as string) : null,
        created_at: r.created_at as string,
        coins_spent: Math.abs(r.amount ?? 0),
        description: (r.description as string | null) ?? null,
        source: "pawbucks" as const,
      })),
    ].filter((r) => {
      if (status === "confirmed") return r.partner_confirmed;
      if (status === "pending") return !r.partner_confirmed;
      return true;
    });

    unified.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

    const count = unified.length;
    const pageRows = unified.slice(offset, offset + limit);

    // Hydrate profile info for each user_id in a single follow-up query.
    const userIds = Array.from(new Set(pageRows.map((r) => r.user_id).filter(Boolean))) as string[];
    let profilesById: Record<string, { full_name: string; email: string }> = {};
    if (userIds.length > 0) {
      const { data: profiles } = await supabaseClient
        .from("profiles")
        .select("id, full_name, email")
        .in("id", userIds);
      profilesById = Object.fromEntries((profiles ?? []).map((p) => [p.id, { full_name: p.full_name, email: p.email }]));
    }

    const redemptions = pageRows.map((r) => ({
      ...r,
      profiles: r.user_id ? profilesById[r.user_id] ?? null : null,
    }));

    console.log(`Listed ${redemptions.length} redemptions for offer ${offerId}`);

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
