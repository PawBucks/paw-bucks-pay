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

type OfferRow = {
  id: string;
  title: string;
  description: string | null;
  offer_type: string;
  coins_required: number | null;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
  is_active: boolean | null;
  per_user_limit: number | null;
  redemption_cap: number | null;
  redemption_count: number | null;
};

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

    // 1. Validate the check-in belongs to this user, this merchant, and is recent.
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

    // 2. Load merchant & determine model.
    const { data: merchant, error: merchantError } = await serviceClient
      .from("merchants")
      .select("id, fee_model, business_name")
      .eq("id", merchantId)
      .maybeSingle();

    if (merchantError || !merchant) {
      return jsonResponse({ error: "Merchant not found" }, 404);
    }

    const feeModel = merchant.fee_model as string | null;
    const isAcquisitionOnly = feeModel === "acquisition_only";
    const isFullEcosystem = feeModel === "full_ecosystem";

    if (!isAcquisitionOnly && !isFullEcosystem) {
      return jsonResponse({ unlocked: [], skipped: "unsupported_fee_model" });
    }

    // 3. First-time customer check (for new_customer offers).
    const { count: priorCheckinCount } = await serviceClient
      .from("checkins")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("merchant_id", merchantId)
      .neq("id", checkinId);

    const { count: priorTxnCount } = await serviceClient
      .from("transactions")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("merchant_id", merchantId);

    const isFirstTimeCustomer =
      (priorCheckinCount ?? 0) === 0 && (priorTxnCount ?? 0) === 0;

    // 4. Determine which offer_types are eligible for this merchant model.
    const eligibleTypes: string[] = isAcquisitionOnly
      ? (isFirstTimeCustomer ? ["new_customer"] : [])
      : (isFirstTimeCustomer
          ? ["new_customer", "partner_deal"]
          : ["partner_deal"]);

    if (eligibleTypes.length === 0) {
      return jsonResponse({
        unlocked: [],
        skipped: "not_first_time_customer",
        message: "New Customer Deals are only available on your first visit.",
      });
    }

    // 5. Load active offers for this merchant of eligible types.
    const nowIso = new Date().toISOString();
    const { data: offers, error: offersError } = await serviceClient
      .from("partner_offers")
      .select(
        "id, title, description, offer_type, coins_required, end_date, start_date, status, is_active, per_user_limit, redemption_cap, redemption_count",
      )
      .eq("partner_id", merchantId)
      .eq("is_active", true)
      .in("offer_type", eligibleTypes);

    if (offersError) {
      console.error("[unlock-merchant-offers] offers query failed", offersError);
      return jsonResponse({ error: "Failed to load offers" }, 500);
    }

    const eligibleOffers = ((offers ?? []) as OfferRow[]).filter((o) => {
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
      return jsonResponse({ unlocked: [], merchant_name: merchant.business_name });
    }

    // 6. For new_customer: at most ONE code per merchant per user, ever.
    //    For partner_deal: one code per offer per user (enforced by unique offer+user).
    const newCustomerOffers = eligibleOffers.filter((o) => o.offer_type === "new_customer");
    const partnerDealOffers = eligibleOffers.filter((o) => o.offer_type === "partner_deal");

    // Existing new-customer unlocks at this merchant (any offer_id)
    const { data: priorNewCustomerUnlocks } = await serviceClient
      .from("offer_redemptions")
      .select("offer_id, redemption_code, redeemed_at, partner_offers!inner(id, title, offer_type, partner_id)")
      .eq("user_id", userId)
      .eq("partner_offers.partner_id", merchantId)
      .eq("partner_offers.offer_type", "new_customer")
      .limit(1);

    const targetOfferIds: string[] = [];

    if (newCustomerOffers.length > 0) {
      if (priorNewCustomerUnlocks && priorNewCustomerUnlocks.length > 0) {
        // already unlocked previously — reuse
        targetOfferIds.push((priorNewCustomerUnlocks[0] as any).offer_id);
      } else {
        const chosen = newCustomerOffers
          .slice()
          .sort((a, b) => (a.id < b.id ? -1 : 1))[0];
        targetOfferIds.push(chosen.id);
      }
    }

    for (const p of partnerDealOffers) targetOfferIds.push(p.id);

    if (targetOfferIds.length === 0) {
      return jsonResponse({ unlocked: [], merchant_name: merchant.business_name });
    }

    // 7. Find existing redemptions for these offers to avoid duplicates.
    const { data: existing, error: existingError } = await serviceClient
      .from("offer_redemptions")
      .select("id, offer_id, redemption_code, redeemed_at, partner_confirmed, created_at")
      .eq("user_id", userId)
      .in("offer_id", targetOfferIds);

    if (existingError) {
      console.error("[unlock-merchant-offers] existing query failed", existingError);
      return jsonResponse({ error: "Failed to check existing unlocks" }, 500);
    }

    const existingByOffer = new Map(
      (existing ?? []).map((r) => [r.offer_id as string, r]),
    );

    // Combine offer metadata by id for the response.
    const offersById = new Map<string, OfferRow>();
    for (const o of eligibleOffers) offersById.set(o.id, o);
    // Also include the reused prior new_customer offer metadata if it wasn't in eligibleOffers.
    if (
      newCustomerOffers.length === 0 &&
      priorNewCustomerUnlocks &&
      priorNewCustomerUnlocks.length > 0
    ) {
      const r = priorNewCustomerUnlocks[0] as any;
      offersById.set(r.offer_id, {
        id: r.offer_id,
        title: r.partner_offers?.title ?? "New Customer Deal",
        description: null,
        offer_type: "new_customer",
        coins_required: null,
        start_date: null,
        end_date: null,
        status: "active",
        is_active: true,
        per_user_limit: null,
        redemption_cap: null,
        redemption_count: null,
      });
    }

    const toCreate = targetOfferIds
      .filter((id) => !existingByOffer.has(id))
      .map((id) => offersById.get(id))
      .filter(Boolean) as OfferRow[];

    // 8. Claim a merchant pre-generated code when available, else generate one.
    const created: Array<{ offer_id: string; redemption_code: string }> = [];
    for (const offer of toCreate) {
      // 8a. Try to claim an unassigned code from the merchant's pre-generated pool.
      let claimed: { offer_id: string; redemption_code: string } | null = null;
      for (let attempt = 0; attempt < 3 && !claimed; attempt++) {
        const { data: poolRow } = await serviceClient
          .from("offer_redemptions")
          .select("id, redemption_code")
          .eq("offer_id", offer.id)
          .is("user_id", null)
          .is("redeemed_at", null)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (!poolRow) break;
        const { data: claimedRow } = await serviceClient
          .from("offer_redemptions")
          .update({ user_id: userId })
          .eq("id", poolRow.id)
          .is("user_id", null)
          .select("offer_id, redemption_code")
          .maybeSingle();
        if (claimedRow) {
          claimed = {
            offer_id: claimedRow.offer_id as string,
            redemption_code: claimedRow.redemption_code as string,
          };
        }
      }
      if (claimed) {
        created.push(claimed);
        continue;
      }

      const { data: codeData, error: codeError } = await serviceClient.rpc(
        "generate_redemption_code",
      );
      if (codeError || !codeData) {
        console.error("[unlock-merchant-offers] generate code failed", codeError);
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
        // Unique-violation race — fall back to existing row.
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
          });
        } else {
          console.error("[unlock-merchant-offers] insert failed", insertError);
        }
        continue;
      }
      if (inserted) {
        created.push({
          offer_id: inserted.offer_id as string,
          redemption_code: inserted.redemption_code as string,
        });
      }
    }

    // 9. Build response.
    const result = targetOfferIds.map((offerId) => {
      const meta = offersById.get(offerId);
      const existingRow = existingByOffer.get(offerId);
      if (existingRow) {
        return {
          offer_id: offerId,
          title: meta?.title ?? null,
          offer_type: meta?.offer_type ?? null,
          redemption_code: existingRow.redemption_code as string,
          already_unlocked: true,
          redeemed: !!existingRow.redeemed_at,
        };
      }
      const newly = created.find((c) => c.offer_id === offerId);
      if (newly) {
        return {
          offer_id: offerId,
          title: meta?.title ?? null,
          offer_type: meta?.offer_type ?? null,
          redemption_code: newly.redemption_code,
          already_unlocked: false,
          redeemed: false,
        };
      }
      return null;
    }).filter(Boolean);

    console.log(
      `[unlock-merchant-offers] user=${userId} merchant=${merchantId} model=${feeModel} unlocked=${result.length} (new=${created.length})`,
    );

    return jsonResponse({
      unlocked: result,
      merchant_name: merchant.business_name,
      fee_model: feeModel,
    });
  } catch (err) {
    console.error("[unlock-merchant-offers] error", err);
    return jsonResponse({ error: (err as Error).message ?? "Server error" }, 500);
  }
});