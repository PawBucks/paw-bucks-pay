import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CHECKIN_VALIDITY_MS = 15 * 60 * 1000; // 15 minutes

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const token = authHeader.replace("Bearer ", "");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const authClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
    const userId = claimsData.claims.sub as string;

    const body = await req.json().catch(() => null);
    const merchantId: string | undefined = body?.merchant_id;
    const checkinId: string | undefined = body?.checkin_id;
    if (!merchantId || !checkinId) {
      return jsonResponse({ error: "merchant_id and checkin_id required" }, 400);
    }

    // 1. Verify the check-in belongs to this user, this merchant, and is recent.
    const { data: checkin, error: checkinError } = await serviceClient
      .from("checkins")
      .select("id, user_id, merchant_id, checked_in_at, created_at")
      .eq("id", checkinId)
      .maybeSingle();

    if (checkinError || !checkin) {
      return jsonResponse({ error: "Check-in not found" }, 404);
    }
    if (checkin.user_id !== userId || checkin.merchant_id !== merchantId) {
      return jsonResponse({ error: "Check-in does not match user/merchant" }, 403);
    }
    const checkinTime = new Date(checkin.checked_in_at ?? checkin.created_at).getTime();
    if (Date.now() - checkinTime > CHECKIN_VALIDITY_MS) {
      return jsonResponse({ error: "Check-in is no longer eligible to unlock offers" }, 410);
    }

    // 2. Verify merchant is acquisition-only.
    const { data: merchant, error: merchantError } = await serviceClient
      .from("merchants")
      .select("id, fee_model, business_name")
      .eq("id", merchantId)
      .maybeSingle();

    if (merchantError || !merchant) {
      return jsonResponse({ error: "Merchant not found" }, 404);
    }
    if (merchant.fee_model !== "acquisition_only") {
      return jsonResponse({ unlocked: [], skipped: "not_acquisition_only" });
    }

    // 3. Load active offers for this merchant within the active window.
    const nowIso = new Date().toISOString();
    const { data: offers, error: offersError } = await serviceClient
      .from("partner_offers")
      .select(
        "id, title, description, coins_required, end_date, start_date, status, is_active, per_user_limit, redemption_cap, redemption_count",
      )
      .eq("partner_id", merchantId)
      .eq("is_active", true);

    if (offersError) {
      console.error("[unlock-acquisition-offers] offers query failed", offersError);
      return jsonResponse({ error: "Failed to load offers" }, 500);
    }

    const eligibleOffers = (offers ?? []).filter((o) => {
      if (o.status && o.status !== "active") return false;
      if (o.start_date && new Date(o.start_date).toISOString() > nowIso) return false;
      if (o.end_date && new Date(o.end_date).toISOString() < nowIso) return false;
      if (
        typeof o.redemption_cap === "number" &&
        o.redemption_cap > 0 &&
        typeof o.redemption_count === "number" &&
        o.redemption_count >= o.redemption_cap
      ) {
        return false;
      }
      return true;
    });

    if (eligibleOffers.length === 0) {
      return jsonResponse({ unlocked: [] });
    }

    // 4. Find existing redemptions so we are idempotent.
    const offerIds = eligibleOffers.map((o) => o.id);
    const { data: existing, error: existingError } = await serviceClient
      .from("offer_redemptions")
      .select("id, offer_id, redemption_code, redeemed_at, partner_confirmed, created_at")
      .eq("user_id", userId)
      .in("offer_id", offerIds);

    if (existingError) {
      console.error("[unlock-acquisition-offers] existing query failed", existingError);
      return jsonResponse({ error: "Failed to check existing unlocks" }, 500);
    }

    const existingByOffer = new Map(
      (existing ?? []).map((r) => [r.offer_id as string, r]),
    );

    const toCreate = eligibleOffers.filter((o) => !existingByOffer.has(o.id));

    // 5. Generate codes for new unlocks.
    const created: Array<{
      offer_id: string;
      redemption_code: string;
      title: string;
    }> = [];

    for (const offer of toCreate) {
      const { data: codeData, error: codeError } = await serviceClient.rpc(
        "generate_redemption_code",
      );
      if (codeError || !codeData) {
        console.error("[unlock-acquisition-offers] generate code failed", codeError);
        continue;
      }
      const { data: inserted, error: insertError } = await serviceClient
        .from("offer_redemptions")
        .insert({
          offer_id: offer.id,
          user_id: userId,
          redemption_code: codeData as string,
          partner_confirmed: false,
        })
        .select("offer_id, redemption_code")
        .maybeSingle();

      if (insertError) {
        // Likely a unique-violation if a concurrent unlock happened — fall back to existing row.
        const { data: existingRow } = await serviceClient
          .from("offer_redemptions")
          .select("offer_id, redemption_code")
          .eq("user_id", userId)
          .eq("offer_id", offer.id)
          .maybeSingle();
        if (existingRow) {
          created.push({
            offer_id: existingRow.offer_id as string,
            redemption_code: existingRow.redemption_code as string,
            title: offer.title,
          });
        } else {
          console.error("[unlock-acquisition-offers] insert failed", insertError);
        }
        continue;
      }
      if (inserted) {
        created.push({
          offer_id: inserted.offer_id as string,
          redemption_code: inserted.redemption_code as string,
          title: offer.title,
        });
      }
    }

    // 6. Combine new + existing for the response.
    const result = eligibleOffers
      .map((o) => {
        const existingRow = existingByOffer.get(o.id);
        if (existingRow) {
          return {
            offer_id: o.id,
            title: o.title,
            redemption_code: existingRow.redemption_code as string,
            already_unlocked: true,
            redeemed: !!existingRow.redeemed_at,
          };
        }
        const newly = created.find((c) => c.offer_id === o.id);
        if (newly) {
          return {
            offer_id: o.id,
            title: o.title,
            redemption_code: newly.redemption_code,
            already_unlocked: false,
            redeemed: false,
          };
        }
        return null;
      })
      .filter(Boolean);

    console.log(
      `[unlock-acquisition-offers] user=${userId} merchant=${merchantId} unlocked=${result.length} (new=${created.length})`,
    );

    return jsonResponse({
      unlocked: result,
      merchant_name: merchant.business_name,
    });
  } catch (err) {
    console.error("[unlock-acquisition-offers] error", err);
    return jsonResponse({ error: (err as Error).message ?? "Server error" }, 500);
  }
});