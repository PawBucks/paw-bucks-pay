import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "npm:@supabase/supabase-js@2.57.2";
import { resolveUserEarnTier } from "../_shared/resolve-tier.ts";
import { isPetOwnerPawBucksEarningEnabled } from "../_shared/pet-owner-earning-kill-switch.ts";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const log = (step: string, details?: unknown) => {
  const d = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECONCILE-TXN] ${step}${d}`);
};

/**
 * Platform-wide reconciliation job.
 *
 * For each merchant with a Stripe Connect account, list recent succeeded
 * PaymentIntents on that connected account and confirm that each one is
 * represented somewhere in our data model. If a PaymentIntent has no
 * corresponding record in ANY of the destination tables that our webhook
 * writes to (`transactions`, `invoice_payments`, `direct_payments`,
 * `merchant_service_purchases`, `pos_transactions`, `pet_store_orders`,
 * `admin_invoice_payments`), we treat it as an erased/missed event and
 * restore the `transactions` row using the PaymentIntent metadata.
 *
 * We never double-award PawBucks: if a `pawbucks_activity` row already
 * exists for the PI, rewards are considered already granted and we only
 * backfill the transactions row.
 */
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Only cron / admin callers with the internal secret can trigger this
  // reconciliation. Without this guard anyone could force reward payouts
  // and Stripe API traffic.
  const authFail = await checkInternalSecret(req, corsHeaders);
  if (authFail) return authFail;

  const runId = crypto.randomUUID();
  const startedAt = Date.now();

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Parse options
    let hours = 48;
    let dryRun = false;
    try {
      if (req.method === "POST") {
        const body = await req.json().catch(() => ({}));
        if (typeof body.hours === "number" && body.hours > 0 && body.hours <= 24 * 30) {
          hours = body.hours;
        }
        if (body.dryRun === true) dryRun = true;
      }
    } catch (_) { /* ignore */ }

    const sinceUnix = Math.floor((Date.now() - hours * 3600 * 1000) / 1000);
    log("Run started", { runId, hours, dryRun, sinceUnix });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // 1) Load merchants with a Stripe Connect account.
    const { data: merchants, error: merchantErr } = await supabase
      .from("merchants")
      .select("id, business_name, stripe_account_id")
      .not("stripe_account_id", "is", null);
    if (merchantErr) throw new Error(`Failed to load merchants: ${merchantErr.message}`);

    log("Merchants to scan", { count: merchants?.length ?? 0 });

    let scanned = 0;
    let restored = 0;
    let skippedExists = 0;
    let skippedNoMetadata = 0;
    let errors = 0;

    const earnEnabled = await isPetOwnerPawBucksEarningEnabled(supabase);

    for (const merchant of merchants ?? []) {
      const acctId = merchant.stripe_account_id as string;

      // 2) Page through succeeded PIs on this connected account.
      let hasMore = true;
      let startingAfter: string | undefined = undefined;
      while (hasMore) {
        let page: Stripe.ApiList<Stripe.PaymentIntent>;
        try {
          page = await stripe.paymentIntents.list(
            {
              created: { gte: sinceUnix },
              limit: 100,
              starting_after: startingAfter,
            },
            { stripeAccount: acctId }
          );
        } catch (e) {
          errors++;
          log("Stripe list failed", { acctId, error: (e as Error).message });
          await supabase.from("transaction_reconciliation_log").insert({
            run_id: runId,
            stripe_account_id: acctId,
            merchant_id: merchant.id,
            action: "error",
            error_message: `stripe.paymentIntents.list failed: ${(e as Error).message}`,
          });
          break;
        }

        for (const pi of page.data) {
          scanned++;
          if (pi.status !== "succeeded") continue;

          const result = await reconcilePaymentIntent({
            supabase,
            stripe,
            pi,
            merchant,
            acctId,
            runId,
            dryRun,
            earnEnabled,
          });
          if (result === "restored") restored++;
          else if (result === "skipped_exists") skippedExists++;
          else if (result === "skipped_no_metadata") skippedNoMetadata++;
          else if (result === "error") errors++;
        }

        hasMore = page.has_more;
        startingAfter = page.data.length ? page.data[page.data.length - 1].id : undefined;
        if (!startingAfter) hasMore = false;
      }
    }

    const durationMs = Date.now() - startedAt;
    const summary = { runId, hours, dryRun, scanned, restored, skippedExists, skippedNoMetadata, errors, durationMs };
    log("Run complete", summary);

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log("Fatal error", { message });
    return new Response(JSON.stringify({ error: message, runId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});

type SupabaseAdmin = ReturnType<typeof createClient>;

async function reconcilePaymentIntent(args: {
  supabase: SupabaseAdmin;
  stripe: Stripe;
  pi: Stripe.PaymentIntent;
  merchant: { id: string; business_name: string | null; stripe_account_id: string | null };
  acctId: string;
  runId: string;
  dryRun: boolean;
  earnEnabled: boolean;
}): Promise<"restored" | "skipped_exists" | "skipped_no_metadata" | "error"> {
  const { supabase, stripe, pi, merchant, acctId, runId, dryRun, earnEnabled } = args;

  try {
    // Check every destination table our webhook writes to for this PI.
    const [txExists, invPayExists, directExists, servicePurchaseExists, posExists, storeOrderExists, adminInvExists] =
      await Promise.all([
        exists(supabase, "transactions", "stripe_payment_intent_id", pi.id),
        exists(supabase, "invoice_payments", "stripe_payment_intent_id", pi.id),
        exists(supabase, "direct_payments", "stripe_payment_intent_id", pi.id),
        exists(supabase, "merchant_service_purchases", "stripe_payment_intent_id", pi.id),
        exists(supabase, "pos_transactions", "stripe_payment_intent_id", pi.id),
        exists(supabase, "pet_store_orders", "stripe_payment_intent_id", pi.id),
        exists(supabase, "admin_invoice_payments", "stripe_payment_intent_id", pi.id),
      ]);

    // If any destination already records this PI, nothing to restore.
    if (
      txExists ||
      invPayExists ||
      directExists ||
      servicePurchaseExists ||
      posExists ||
      storeOrderExists ||
      adminInvExists
    ) {
      // Special case: PI recorded elsewhere (e.g. invoice_payments) but the
      // `transactions` row was erased. If metadata says a transactions row
      // is expected, restore it.
      const shouldAlsoHaveTx =
        !txExists &&
        (invPayExists || directExists || servicePurchaseExists || posExists || storeOrderExists);
      if (!shouldAlsoHaveTx) {
        await logAction(supabase, {
          run_id: runId,
          stripe_payment_intent_id: pi.id,
          stripe_account_id: acctId,
          merchant_id: merchant.id,
          action: "skipped_exists",
          target_table: txExists ? "transactions" : "other",
          amount: pi.amount / 100,
          details: {
            txExists, invPayExists, directExists, servicePurchaseExists,
            posExists, storeOrderExists, adminInvExists,
          },
        });
        return "skipped_exists";
      }
    }

    const metadata = (pi.metadata ?? {}) as Record<string, string>;
    const userId = metadata.user_id || null;
    const merchantIdFromMeta = metadata.merchant_id || merchant.id;

    if (!userId) {
      await logAction(supabase, {
        run_id: runId,
        stripe_payment_intent_id: pi.id,
        stripe_account_id: acctId,
        merchant_id: merchant.id,
        action: "skipped_no_metadata",
        amount: pi.amount / 100,
        details: { reason: "missing metadata.user_id", metadata },
      });
      return "skipped_no_metadata";
    }

    // Compute amounts.
    const cardAmount = pi.amount / 100;
    const tipAmount = Number(metadata.tip_amount || 0) / 100;
    const pawbucksUsed = parseInt(metadata.pawbucks_used || "0", 10) || 0;
    const pawbucksAmountCents = parseInt(metadata.pawbucks_amount_cents || "0", 10) || 0;
    const pawbucksAmount = pawbucksAmountCents / 100;
    const totalAmount = cardAmount + pawbucksAmount;
    const rewardBaseAmount = Math.max(0, cardAmount - tipAmount);
    const applicationFee = Number(pi.application_fee_amount || 0) / 100 || cardAmount * 0.03;

    // Determine rewards. Only insert new rewards if no pawbucks_activity exists.
    let rewardsEarned = 0;
    const { data: existingReward } = await supabase
      .from("pawbucks_activity")
      .select("id, amount")
      .eq("stripe_payment_intent_id", pi.id)
      .maybeSingle();

    if (existingReward) {
      rewardsEarned = existingReward.amount ?? 0;
    } else if (earnEnabled && rewardBaseAmount > 0) {
      try {
        const { data: platformSub } = await supabase
          .from("subscriptions")
          .select("stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status")
          .eq("user_id", userId)
          .in("status", ["active", "trialing"])
          .maybeSingle();
        const tier = await resolveUserEarnTier(stripe, platformSub);
        rewardsEarned = Math.floor(rewardBaseAmount * tier.multiplier);
      } catch (e) {
        log("Tier resolution failed; defaulting to 10x", { error: (e as Error).message });
        rewardsEarned = Math.floor(rewardBaseAmount * 10);
      }
    }

    if (dryRun) {
      await logAction(supabase, {
        run_id: runId,
        stripe_payment_intent_id: pi.id,
        stripe_account_id: acctId,
        merchant_id: merchantIdFromMeta,
        user_id: userId,
        action: "restored",
        target_table: "transactions",
        amount: totalAmount,
        details: { dryRun: true, cardAmount, pawbucksAmount, rewardsEarned },
      });
      return "restored";
    }

    // Restore the transactions row.
    const description =
      metadata.description ||
      (metadata.plan_name
        ? `${metadata.plan_name} subscription${merchant.business_name ? ` to ${merchant.business_name}` : ""}`
        : `Payment to ${merchant.business_name ?? "merchant"}`);

    const { data: inserted, error: insertErr } = await supabase
      .from("transactions")
      .insert({
        user_id: userId,
        merchant_id: merchantIdFromMeta,
        amount: totalAmount,
        stripe_amount: cardAmount,
        pawbucks_used: pawbucksUsed,
        application_fee: applicationFee,
        cashback_earned: rewardsEarned,
        rewards_earned: rewardsEarned,
        description,
        status: "completed",
        stripe_payment_intent_id: pi.id,
        created_at: new Date(pi.created * 1000).toISOString(),
      })
      .select("id")
      .single();

    if (insertErr) {
      // Unique-violation on stripe_payment_intent_id means a concurrent
      // process (webhook) just restored it — treat as skipped.
      if ((insertErr as { code?: string }).code === "23505") {
        await logAction(supabase, {
          run_id: runId,
          stripe_payment_intent_id: pi.id,
          stripe_account_id: acctId,
          merchant_id: merchantIdFromMeta,
          user_id: userId,
          action: "skipped_exists",
          target_table: "transactions",
          amount: totalAmount,
          details: { reason: "unique_violation_on_insert" },
        });
        return "skipped_exists";
      }
      throw new Error(insertErr.message);
    }

    await logAction(supabase, {
      run_id: runId,
      stripe_payment_intent_id: pi.id,
      stripe_account_id: acctId,
      merchant_id: merchantIdFromMeta,
      user_id: userId,
      action: "restored",
      target_table: "transactions",
      restored_transaction_id: inserted?.id,
      amount: totalAmount,
      details: {
        cardAmount,
        pawbucksAmount,
        pawbucksUsed,
        applicationFee,
        rewardsEarned,
        rewardsAlreadyExisted: !!existingReward,
      },
    });

    return "restored";
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    log("reconcilePaymentIntent error", { pi: pi.id, error: message });
    await logAction(supabase, {
      run_id: runId,
      stripe_payment_intent_id: pi.id,
      stripe_account_id: acctId,
      merchant_id: merchant.id,
      action: "error",
      error_message: message,
    });
    return "error";
  }
}

async function exists(
  supabase: SupabaseAdmin,
  table: string,
  column: string,
  value: string
): Promise<boolean> {
  const { data, error } = await supabase.from(table).select("id").eq(column, value).limit(1).maybeSingle();
  if (error) {
    log("exists() failed", { table, column, error: error.message });
    return false;
  }
  return !!data;
}

async function logAction(
  supabase: SupabaseAdmin,
  row: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase.from("transaction_reconciliation_log").insert(row);
  if (error) log("Failed to write reconciliation log", { error: error.message });
}