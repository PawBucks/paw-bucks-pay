import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key, x-clover-auth, x-clover-verification-code, clover-auth-signature, clover-signature",
};

const PLATFORM_FEE_RATE = 0.03; // 3% success fee on USD portion

// Clover webhook payload schema
const cloverWebhookSchema = z.object({
  // Clover order/payment identifiers
  orderId: z.string().max(255).optional().nullable(),
  paymentId: z.string().max(255).optional().nullable(),
  // Transaction amount in cents from Clover
  amount: z.number().positive().max(100000000),
  // Tender label — we only process 'PawBucks' tagged tenders
  tender: z.string().max(100),
  // Customer identification
  customer_email: z.string().email().max(255).optional().nullable(),
  customer_phone: z.string().max(20).optional().nullable(),
  // PawBucks amount the customer wants to redeem (in raw PawBucks units)
  pawbucks_amount: z.number().int().nonnegative().optional().default(0),
  // Optional metadata
  tip_amount: z.number().nonnegative().optional().default(0),
  timestamp: z.string().optional().nullable(),
  items: z
    .array(
      z.object({
        name: z.string().max(255).optional(),
        quantity: z.number().positive().optional(),
        price: z.number().nonnegative().optional(),
      })
    )
    .optional()
    .nullable(),
});

async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hmacSha256Hex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function verifyCloverAuthHeader(
  providedHeader: string,
  rawBody: string,
): Promise<boolean> {
  const configuredSecret =
    (Deno.env.get("CLOVER_AUTH_CODE") ||
      Deno.env.get("CLOVER_APP_SIGNING_SECRET") ||
      "").trim();

  if (!configuredSecret) return false;

  const provided = providedHeader.trim();

  // Clover Developer Dashboard webhooks send the Clover Auth Code as a static
  // X-Clover-Auth header after the callback URL is verified. This is not HMAC.
  if (constantTimeEqual(provided, configuredSecret)) return true;

  // Keep backward compatibility with the earlier HMAC implementation and with
  // any Hosted Checkout-style signatures using the same stored secret.
  const normalizedProvided = provided.replace(/^sha256=/i, "").trim().toLowerCase();
  const expectedBodyHmac = await hmacSha256Hex(configuredSecret, rawBody);
  if (constantTimeEqual(expectedBodyHmac, normalizedProvided)) return true;

  return false;
}

function extractCloverMerchantId(payload: any): string | null {
  if (!payload || typeof payload !== "object") return null;
  const direct = payload.merchant || payload.merchantId || payload.merchant_id;
  if (typeof direct === "string" && direct.trim()) return direct.trim();
  if (
    payload.merchants &&
    typeof payload.merchants === "object" &&
    !Array.isArray(payload.merchants)
  ) {
    const [firstMerchantId] = Object.keys(payload.merchants);
    return firstMerchantId || null;
  }
  return null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ── 0. Clover Marketplace verification challenge (must run before auth) ──
  const url = new URL(req.url);
  if (req.method === "GET") {
    const code =
      url.searchParams.get("verification_code") ||
      url.searchParams.get("verificationCode");
    if (code) {
      return new Response(code, {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "text/plain" },
      });
    }
    return new Response("ok", {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "text/plain" },
    });
  }

  // Read the raw body once so signature verification and JSON parsing stay in sync.
  const rawBody = req.method === "POST" ? await req.text() : "";
  let parsedBody: any = null;
  if (rawBody) {
    // Try JSON first
    try {
      parsedBody = JSON.parse(rawBody);
    } catch {
      // Fall back to form-encoded (Clover sometimes sends application/x-www-form-urlencoded)
      try {
        const params = new URLSearchParams(rawBody);
        const obj: Record<string, string> = {};
        for (const [k, v] of params.entries()) obj[k] = v;
        if (Object.keys(obj).length > 0) parsedBody = obj;
      } catch {
        parsedBody = null;
      }
    }
  }

  // ── Clover Marketplace verification challenge on POST ──
  // Clover verifies webhook ownership by POSTing a body containing a
  // `verificationCode` (JSON or form-encoded), sometimes also via query string
  // or a header. Echo it back with 200 BEFORE any auth check.
  const verificationCode =
    (parsedBody && typeof parsedBody === "object" &&
      (parsedBody.verificationCode || parsedBody.verification_code)) ||
    url.searchParams.get("verificationCode") ||
    url.searchParams.get("verification_code") ||
    req.headers.get("x-clover-verification-code") ||
    null;

  if (verificationCode) {
    return new Response(JSON.stringify({ verificationCode }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Clover's app-level webhook notifications are event envelopes, not full
  // payment rows. They look like: { appId, merchants: { MERCHANT_ID: [...] } }.
  // Acknowledge those with 200 so Clover keeps the webhook healthy. Direct POS
  // transaction pushes still require x-api-key or a valid Clover auth header.
  const looksLikeTransaction =
    parsedBody && typeof parsedBody === "object" &&
    (parsedBody.amount !== undefined || parsedBody.tender !== undefined);

  const looksLikeCloverMarketplaceEvent =
    parsedBody && typeof parsedBody === "object" &&
    (parsedBody.appId !== undefined ||
      parsedBody.merchants !== undefined ||
      parsedBody.objectId !== undefined);

  if (!looksLikeTransaction && looksLikeCloverMarketplaceEvent) {
    return new Response(
      JSON.stringify({
        success: true,
        acknowledged: true,
        source: "clover_marketplace_event",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  if (!looksLikeTransaction) {
    return new Response(
      JSON.stringify({ success: true, acknowledged: true, source: "non_transaction_ping" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // ── 1. Authenticate: either Clover Marketplace signature OR merchant POS API key ──
    const cloverSig =
      req.headers.get("x-clover-auth") ||
      req.headers.get("clover-auth-signature");
    const apiKey = req.headers.get("x-api-key");

    let integration: { id: string; merchant_id: string; is_active: boolean } | null = null;

    if (cloverSig) {
      const hasConfiguredCloverAuth = Boolean(
        (Deno.env.get("CLOVER_AUTH_CODE") ||
          Deno.env.get("CLOVER_APP_SIGNING_SECRET") ||
          "").trim(),
      );
      if (!hasConfiguredCloverAuth) {
        console.error("Clover webhook: Clover auth code/signing secret not configured");
        return new Response(
          JSON.stringify({ error: "Clover auth is not configured" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const validCloverHeader = await verifyCloverAuthHeader(cloverSig, rawBody);
      if (!validCloverHeader) {
        console.error("Clover webhook: invalid Clover auth header");
        return new Response(
          JSON.stringify({ error: "Invalid Clover auth header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const cloverMerchantId = extractCloverMerchantId(parsedBody);
      if (!cloverMerchantId) {
        console.error("Clover webhook: signed event missing merchant id");
        return new Response(
          JSON.stringify({ error: "Missing merchant identifier in signed event" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }

      const { data: matched, error: matchErr } = await supabaseAdmin
        .from("merchant_pos_integrations")
        .select("id, merchant_id, is_active")
        .eq("clover_merchant_id", cloverMerchantId)
        .maybeSingle();
      if (matchErr || !matched) {
        console.error("Clover webhook: no integration for clover merchant", cloverMerchantId, matchErr);
        return new Response(
          JSON.stringify({ error: "Unknown Clover merchant" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      integration = matched;
    } else {
      if (!apiKey) {
        console.error("Clover webhook: missing auth (no x-clover-auth and no x-api-key)");
        return new Response(
          JSON.stringify({ error: "Missing authentication header" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      if (!apiKey.startsWith("pk_live_")) {
        console.error("Clover webhook: api key wrong format");
        return new Response(
          JSON.stringify({ error: "Invalid API key format" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      const apiKeyHash = await hashApiKey(apiKey);
      const { data: found, error: integrationError } = await supabaseAdmin
        .from("merchant_pos_integrations")
        .select("id, merchant_id, is_active")
        .eq("api_key_hash", apiKeyHash)
        .single();
      if (integrationError || !found) {
        console.error("Clover webhook: API key lookup failed", integrationError);
        return new Response(
          JSON.stringify({ error: "Invalid API key" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      integration = found;
    }

    if (!integration!.is_active) {
      return new Response(
        JSON.stringify({ error: "Integration is deactivated" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Update last_used_at
    await supabaseAdmin
      .from("merchant_pos_integrations")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", integration!.id);

    // ── 2. Validate payload ──
    const parsed = cloverWebhookSchema.safeParse(parsedBody ?? {});

    if (!parsed.success) {
      const errors = parsed.error.errors.map((e) => e.message).join(", ");
      console.error("Clover webhook: validation failed", errors);
      return new Response(
        JSON.stringify({ error: `Invalid payload: ${errors}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      orderId,
      paymentId,
      amount: amountCents,
      tender,
      customer_email,
      customer_phone,
      pawbucks_amount,
      tip_amount: tipCents,
      timestamp,
      items,
    } = parsed.data;

    // ── 3. Only process PawBucks-tagged tenders ──
    if (tender.toLowerCase() !== "pawbucks") {
      return new Response(
        JSON.stringify({
          success: true,
          skipped: true,
          message: "Tender is not PawBucks — no action taken.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Convert cents → dollars
    const totalAmountUsd = amountCents / 100;
    const tipAmountUsd = tipCents / 100;

    const externalTxId = paymentId || orderId || null;

    // ── 4. Idempotency: check for duplicate ──
    if (externalTxId) {
      const { data: existing } = await supabaseAdmin
        .from("pos_transactions")
        .select("id, status, pawbucks_awarded")
        .eq("integration_id", integration.id)
        .eq("external_transaction_id", externalTxId)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            duplicate: true,
            transaction_id: existing.id,
            message: "Transaction already processed.",
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // ── 5. Identify the Pet Owner ──
    let matchedUser: { id: string; full_name: string | null; email: string | null } | null = null;

    if (customer_email) {
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("email", customer_email.toLowerCase().trim())
        .single();
      if (data) matchedUser = data;
    }

    if (!matchedUser && customer_phone) {
      const cleanPhone = customer_phone.replace(/\D/g, "");
      const { data } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .eq("phone", cleanPhone)
        .single();
      if (data) matchedUser = data;
    }

    if (!matchedUser) {
      // Record the transaction as unmatched
      const { data: posTx } = await supabaseAdmin
        .from("pos_transactions")
        .insert({
          integration_id: integration.id,
          merchant_id: integration.merchant_id,
          external_transaction_id: externalTxId,
          customer_email: customer_email?.toLowerCase().trim() || null,
          customer_phone: customer_phone?.replace(/\D/g, "") || null,
          amount: totalAmountUsd,
          currency: "USD",
          items: items || null,
          pos_timestamp: timestamp ? new Date(timestamp).toISOString() : null,
          status: "pending",
          error_message: "No matching PawBucks user found",
        })
        .select("id")
        .single();

      return new Response(
        JSON.stringify({
          success: false,
          transaction_id: posTx?.id || null,
          error: "Customer not found in PawBucks system.",
        }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 6. Verify PawBucks balance ──
    const { data: walletData } = await supabaseAdmin
      .from("pawbucks_wallet")
      .select("balance")
      .eq("user_id", matchedUser.id)
      .single();

    const currentBalance = walletData?.balance ?? 0;

    // If Clover sent a pawbucks_amount, verify the customer can cover it
    const requestedPawbucks = pawbucks_amount || 0;

    if (requestedPawbucks > 0 && requestedPawbucks > currentBalance) {
      // Record transaction as failed — insufficient balance
      const { data: posTx } = await supabaseAdmin
        .from("pos_transactions")
        .insert({
          integration_id: integration.id,
          merchant_id: integration.merchant_id,
          external_transaction_id: externalTxId,
          customer_email: customer_email?.toLowerCase().trim() || null,
          customer_phone: customer_phone?.replace(/\D/g, "") || null,
          amount: totalAmountUsd,
          currency: "USD",
          items: items || null,
          pos_timestamp: timestamp ? new Date(timestamp).toISOString() : null,
          status: "failed",
          matched_user_id: matchedUser.id,
          error_message: `Insufficient PawBucks: requested ${requestedPawbucks}, available ${currentBalance}`,
        })
        .select("id")
        .single();

      return new Response(
        JSON.stringify({
          success: false,
          transaction_id: posTx?.id || null,
          error: "Insufficient PawBucks balance",
          available_balance: currentBalance,
          requested: requestedPawbucks,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── 7. Calculate commission split (3% on USD portion only) ──
    // PawBucks to USD: 1 PB = $0.001  →  1000 PB = $1.00
    const pawbucksUsdValue = requestedPawbucks * 0.001;
    const cashPortionUsd = totalAmountUsd - pawbucksUsdValue;
    const networkFee = Math.round(cashPortionUsd * PLATFORM_FEE_RATE * 100) / 100; // 3% of cash portion
    const netPayoutToMerchant =
      Math.round((cashPortionUsd - networkFee + tipAmountUsd) * 100) / 100;

    // ── 8. Get merchant info ──
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("business_name, cashback_rate")
      .eq("id", integration.merchant_id)
      .single();

    const cashbackRate = merchant?.cashback_rate || 5;
    // PawBucks earn: only on the cash portion
    let pawbucksEarned = Math.floor(cashPortionUsd * (cashbackRate / 100));

    // Global kill switch: SuperAdmin can pause pet-owner PawBucks earning platform-wide
    {
      const { isPetOwnerPawBucksEarningEnabled } = await import("../_shared/pet-owner-earning-kill-switch.ts");
      const earnEnabled = await isPetOwnerPawBucksEarningEnabled(supabaseAdmin);
      if (!earnEnabled) {
        console.log('[CLOVER] Pet-owner PawBucks earning disabled platform-wide; overriding to 0');
        pawbucksEarned = 0;
      }
    }

    // Acquisition-Only enforcement: only first-visit customers earn PawBucks.
    try {
      const { data: merchantFee } = await supabaseAdmin
        .from('merchants')
        .select('fee_model')
        .eq('id', integration.merchant_id)
        .maybeSingle();
      if (merchantFee?.fee_model === 'acquisition_only') {
        const { count } = await supabaseAdmin
          .from('transactions')
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', integration.merchant_id)
          .eq('user_id', matchedUser.id)
          .eq('status', 'completed');
        if ((count || 0) > 0) {
          console.log('[CLOVER] Acquisition-Only + returning customer → suppressing PawBucks', {
            user_id: matchedUser.id,
            merchant_id: integration.merchant_id,
            wouldHaveEarned: pawbucksEarned,
          });
          pawbucksEarned = 0;
        }
      }
    } catch (e) {
      console.error('[CLOVER] Acquisition-Only check error', e);
    }

    // ── 9. Debit PawBucks if redeemed ──
    if (requestedPawbucks > 0) {
      // Deduct from wallet
      const { error: debitWalletErr } = await supabaseAdmin
        .from("pawbucks_wallet")
        .update({
          balance: currentBalance - requestedPawbucks,
          total_spent: (walletData as any)?.total_spent
            ? (walletData as any).total_spent + pawbucksUsdValue
            : pawbucksUsdValue,
        })
        .eq("user_id", matchedUser.id);

      if (debitWalletErr) {
        console.error("Clover webhook: wallet debit failed", debitWalletErr);
        return new Response(
          JSON.stringify({ error: "Failed to debit PawBucks wallet" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Record the debit activity
      await supabaseAdmin.from("pawbucks_activity").insert({
        user_id: matchedUser.id,
        amount: requestedPawbucks,
        type: "redeem",
        source: "clover_pos",
        description: `PawBucks redeemed at ${merchant?.business_name || "Partner Store"} (Clover POS)`,
        partner_id: integration.merchant_id,
        pawbucks_status: "available",
      });
    }

    // ── 10. Award new PawBucks on cash portion ──
    if (pawbucksEarned > 0) {
      await supabaseAdmin.from("pawbucks_activity").insert({
        user_id: matchedUser.id,
        amount: pawbucksEarned,
        type: "earn",
        source: "clover_pos",
        description: `Purchase at ${merchant?.business_name || "Partner Store"} (Clover POS)`,
        partner_id: integration.merchant_id,
        pawbucks_status: "available",
      });
    }

    // ── 11. Record the finalized POS transaction ──
    const { data: posTx, error: insertErr } = await supabaseAdmin
      .from("pos_transactions")
      .insert({
        integration_id: integration.id,
        merchant_id: integration.merchant_id,
        external_transaction_id: externalTxId,
        customer_email: customer_email?.toLowerCase().trim() || null,
        customer_phone: customer_phone?.replace(/\D/g, "") || null,
        amount: totalAmountUsd,
        currency: "USD",
        items: items || null,
        pos_timestamp: timestamp ? new Date(timestamp).toISOString() : null,
        status: "rewarded",
        matched_user_id: matchedUser.id,
        pawbucks_awarded: pawbucksEarned,
        processed_at: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("Clover webhook: failed to insert pos_transaction", insertErr);
      return new Response(
        JSON.stringify({ error: "Failed to record transaction" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `Clover POS [${posTx!.id}]: $${totalAmountUsd} total | ` +
        `PB redeemed: ${requestedPawbucks} ($${pawbucksUsdValue}) | ` +
        `Cash: $${cashPortionUsd} | Fee: $${networkFee} | ` +
        `Merchant payout: $${netPayoutToMerchant} | ` +
        `PB earned: ${pawbucksEarned}`
    );

    // ── 11b. Track Branded PawBucks redemption (FIFO across this merchant's active campaigns) ──
    if (requestedPawbucks > 0) {
      const correlationId = crypto.randomUUID();
      console.log(
        `[CLOVER][branded-redeem][cid=${correlationId}] start`,
        {
          correlation_id: correlationId,
          surface: "clover-pos-webhook",
          user_id: matchedUser.id,
          merchant_id: integration.merchant_id,
          pos_transaction_id: posTx!.id,
          external_transaction_id: externalTxId,
          amount: requestedPawbucks,
        },
      );
      try {
        // Clover POS doesn't map SKUs to brand_id → no product-gate match.
        const { error: brandedRedeemErr } = await supabaseAdmin.rpc("redeem_branded_pawbucks_v2", {
          p_user_id: matchedUser.id,
          p_merchant_id: integration.merchant_id,
          p_amount: requestedPawbucks,
          p_line_items: [],
          p_transaction_id: posTx!.id,
          p_description: `Branded PawBucks redeemed at ${merchant?.business_name || "Partner Store"} (Clover POS) [cid:${correlationId}] [ext:${externalTxId ?? "n/a"}]`,
        });
        if (brandedRedeemErr) {
          console.error(
            `[CLOVER][branded-redeem][cid=${correlationId}] FAILED (non-fatal)`,
            { correlation_id: correlationId, error: brandedRedeemErr.message },
          );
        } else {
          console.log(
            `[CLOVER][branded-redeem][cid=${correlationId}] success`,
            { correlation_id: correlationId },
          );
        }
      } catch (e) {
        console.error(
          `[CLOVER][branded-redeem][cid=${correlationId}] EXCEPTION (non-fatal)`,
          { correlation_id: correlationId, error: (e as Error).message },
        );
      }
    }

    // ── 12. Fire-and-forget: loyalty, badges, timeline ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const commonHeaders = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${serviceKey}`,
      "x-internal-secret": Deno.env.get("INTERNAL_TRIGGER_SECRET") ?? "",
    };

    // Loyalty punch card
    fetch(`${supabaseUrl}/functions/v1/loyalty-punch-advance`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        transaction_id: posTx!.id,
        user_id: matchedUser.id,
        merchant_id: integration.merchant_id,
      }),
    }).catch((e) => console.error("[CLOVER] Loyalty punch error:", e));

    // Loyalty milestones
    fetch(`${supabaseUrl}/functions/v1/advance-loyalty-milestones`, {
      method: "POST",
      headers: commonHeaders,
      body: JSON.stringify({
        transaction_id: posTx!.id,
        user_id: matchedUser.id,
        merchant_id: integration.merchant_id,
        cash_amount: cashPortionUsd,
      }),
    }).catch((e) => console.error("[CLOVER] Milestone error:", e));

    // Guilt-Free Badges
    if (pawbucksEarned > 0) {
      const { data: merchantMeta } = await supabaseAdmin
        .from("merchants")
        .select("business_type")
        .eq("id", integration.merchant_id)
        .single();

      fetch(`${supabaseUrl}/functions/v1/check-guilt-badges`, {
        method: "POST",
        headers: commonHeaders,
        body: JSON.stringify({
          userId: matchedUser.id,
          transactionAmount: cashPortionUsd,
          merchantCategory: merchantMeta?.business_type || "other",
          transactionId: posTx!.id,
        }),
      }).catch((e) => console.error("[CLOVER] Badge error:", e));
    }

    // ── 13. Return finalized response ──
    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: posTx!.id,
        customer_matched: true,
        commission_split: {
          total_amount: totalAmountUsd,
          pawbucks_redeemed: requestedPawbucks,
          pawbucks_usd_value: pawbucksUsdValue,
          cash_portion: cashPortionUsd,
          platform_fee_pct: PLATFORM_FEE_RATE * 100,
          platform_fee: networkFee,
          tip: tipAmountUsd,
          merchant_net_payout: netPayoutToMerchant,
        },
        rewards: {
          pawbucks_earned: pawbucksEarned,
          remaining_balance: currentBalance - requestedPawbucks + pawbucksEarned,
        },
        message: `Transaction finalized. ${networkFee.toFixed(2)} USD fee collected. ${pawbucksEarned} PawBucks earned.`,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("Clover webhook unhandled error:", msg);
    return new Response(
      JSON.stringify({ error: msg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
