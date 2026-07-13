import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-api-key",
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

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ── 1. Authenticate via POS API Key ──
    const apiKey = req.headers.get("x-api-key");
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "Missing x-api-key header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!apiKey.startsWith("pk_live_")) {
      return new Response(
        JSON.stringify({ error: "Invalid API key format" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const apiKeyHash = await hashApiKey(apiKey);

    const { data: integration, error: integrationError } = await supabaseAdmin
      .from("merchant_pos_integrations")
      .select("id, merchant_id, is_active")
      .eq("api_key_hash", apiKeyHash)
      .single();

    if (integrationError || !integration) {
      console.error("Clover webhook: API key lookup failed", integrationError);
      return new Response(
        JSON.stringify({ error: "Invalid API key" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!integration.is_active) {
      return new Response(
        JSON.stringify({ error: "API key is deactivated" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Update last_used_at
    await supabaseAdmin
      .from("merchant_pos_integrations")
      .update({ last_used_at: new Date().toISOString() })
      .eq("id", integration.id);

    // ── 2. Validate payload ──
    const body = await req.json();
    const parsed = cloverWebhookSchema.safeParse(body);

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
