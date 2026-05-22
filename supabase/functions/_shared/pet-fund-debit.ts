// Shared helper for spending PawBucks across wallet → Pet Fund → legacy welcome credit.
// Mirrors the spend order used by confirm-payment-success / create-combined-payment.

// deno-lint-ignore-file no-explicit-any

export interface SpendableSources {
  walletBalance: number;
  petFundLedgerId: string | null;
  petFundAvailable: number;
  petFundMinUsd: number; // min transaction USD for the oldest available release (0 if none)
  legacyCreditBalance: number;
  legacyCreditId: string | null;
}

export async function getSpendableSources(
  supabaseAdmin: any,
  userId: string,
): Promise<SpendableSources> {
  const [walletRes, ledgerRes, releasesRes, legacyRes] = await Promise.all([
    supabaseAdmin.from("pawbucks_wallet").select("balance").eq("user_id", userId).maybeSingle(),
    supabaseAdmin
      .from("pet_fund_ledgers")
      .select("id, available_balance, status")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
    supabaseAdmin
      .from("pet_fund_releases")
      .select("min_transaction_usd")
      .eq("user_id", userId)
      .eq("status", "released")
      .is("used_at", null)
      .order("month_number", { ascending: true })
      .limit(1),
    supabaseAdmin
      .from("user_welcome_credits")
      .select("id, credit_amount, status, expires_at")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle(),
  ]);

  const walletBalance = walletRes.data?.balance || 0;
  const petFundLedgerId = ledgerRes.data?.id || null;
  const petFundAvailable = ledgerRes.data?.available_balance || 0;
  const petFundMinUsd = releasesRes.data?.[0]?.min_transaction_usd
    ? Number(releasesRes.data[0].min_transaction_usd)
    : 0;

  let legacyCreditBalance = 0;
  let legacyCreditId: string | null = null;
  if (
    legacyRes.data &&
    legacyRes.data.expires_at &&
    new Date(legacyRes.data.expires_at) > new Date()
  ) {
    legacyCreditBalance = legacyRes.data.credit_amount || 0;
    legacyCreditId = legacyRes.data.id;
  }

  return {
    walletBalance,
    petFundLedgerId,
    petFundAvailable,
    petFundMinUsd,
    legacyCreditBalance,
    legacyCreditId,
  };
}

export interface DebitPlan {
  walletDeduction: number;
  petFundDeduction: number;
  legacyCreditDeduction: number;
}

/**
 * Plan a PawBucks debit across the three sources in the canonical order:
 * wallet → pet fund (if txn meets min) → legacy welcome credit.
 * Throws if the combined eligible balance is below `pawbucksNeeded`.
 */
export function planPawBucksDebit(
  sources: SpendableSources,
  pawbucksNeeded: number,
  txnTotalUsd: number,
): DebitPlan {
  let remaining = pawbucksNeeded;

  const walletDeduction = Math.min(sources.walletBalance, remaining);
  remaining -= walletDeduction;

  let petFundDeduction = 0;
  if (remaining > 0 && sources.petFundAvailable > 0) {
    const meetsMin = !sources.petFundMinUsd || txnTotalUsd >= sources.petFundMinUsd;
    if (meetsMin) {
      petFundDeduction = Math.min(sources.petFundAvailable, remaining);
      remaining -= petFundDeduction;
    }
  }

  let legacyCreditDeduction = 0;
  if (remaining > 0 && sources.legacyCreditBalance > 0) {
    legacyCreditDeduction = Math.min(sources.legacyCreditBalance, remaining);
    remaining -= legacyCreditDeduction;
  }

  if (remaining > 0) {
    const available =
      sources.walletBalance +
      (petFundDeduction > 0 || sources.petFundAvailable === 0 ? sources.petFundAvailable : 0) +
      sources.legacyCreditBalance;
    throw new Error(
      `Insufficient PawBucks. Need ${pawbucksNeeded.toLocaleString()}, have ${available.toLocaleString()} eligible. ` +
        (sources.petFundMinUsd && txnTotalUsd < sources.petFundMinUsd
          ? `Pet Fund Welcome Credit requires a $${sources.petFundMinUsd.toFixed(2)} minimum purchase.`
          : ""),
    );
  }

  return { walletDeduction, petFundDeduction, legacyCreditDeduction };
}

/** Apply a planned debit. Caller is responsible for logging activity rows. */
export async function applyPawBucksDebit(
  supabaseAdmin: any,
  userId: string,
  plan: DebitPlan,
  context?: { merchantId?: string | null; transactionId?: string | null; transactionTotalCents?: number },
): Promise<void> {
  if (plan.walletDeduction > 0) {
    const { data: w } = await supabaseAdmin
      .from("pawbucks_wallet")
      .select("balance")
      .eq("user_id", userId)
      .single();
    if (w) {
      await supabaseAdmin
        .from("pawbucks_wallet")
        .update({ balance: Math.max(0, w.balance - plan.walletDeduction) })
        .eq("user_id", userId);
    }
  }

  if (plan.petFundDeduction > 0) {
    const { data: releases } = await supabaseAdmin
      .from("pet_fund_releases")
      .select("id, amount, month_number")
      .eq("user_id", userId)
      .eq("status", "released")
      .is("used_at", null)
      .order("month_number", { ascending: true });

    let remaining = plan.petFundDeduction;
    for (const release of releases || []) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, release.amount);
      await supabaseAdmin
        .from("pet_fund_releases")
        .update({ used_at: new Date().toISOString() })
        .eq("id", release.id);
      remaining -= take;
    }

    const { data: ledger } = await supabaseAdmin
      .from("pet_fund_ledgers")
      .select("available_balance, total_used")
      .eq("user_id", userId)
      .single();
    if (ledger) {
      await supabaseAdmin
        .from("pet_fund_ledgers")
        .update({
          available_balance: Math.max(0, ledger.available_balance - plan.petFundDeduction),
          total_used: (ledger.total_used || 0) + plan.petFundDeduction,
        })
        .eq("user_id", userId);
    }
  }

  if (plan.legacyCreditDeduction > 0) {
    // Use the dedicated RPC so phase tracking stays correct.
    if (!context?.merchantId || !context.transactionTotalCents) {
      throw new Error("Legacy welcome credit debit requires merchant and transaction total context");
    }

    const { data, error } = await supabaseAdmin.rpc("redeem_welcome_credit", {
      p_user_id: userId,
      p_merchant_id: context.merchantId,
      p_transaction_total_cents: context.transactionTotalCents,
      p_transaction_id: context.transactionId || null,
    });

    const redemption = Array.isArray(data) ? data[0] : data;
    if (error || !redemption?.success) {
      throw new Error(error?.message || redemption?.message || "Legacy welcome credit redemption failed");
    }
  }
}