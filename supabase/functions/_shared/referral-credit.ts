// Pet Pro referral credit — automatically applied against the platform Success Fee.
//
// Pet Pros earn USD referral rewards ($1/$2 per active referred membership,
// $50 per referred Pet Pro that passes $1,700 in sales). That credit is never
// paid out in cash; it is consumed against the Success Fee on their next
// payments until the balance runs out.
//
// deno-lint-ignore-file no-explicit-any

/**
 * Reduce a platform fee (in cents) by any referral credit the merchant owner has.
 * Returns the fee to charge plus how much credit was applied.
 *
 * `reference` should be a stable id for the payment (e.g. the invoice id or an
 * idempotency key) so retries never consume credit twice.
 */
export async function applyReferralCreditToFee(
  supabaseAdmin: any,
  merchantId: string | null | undefined,
  feeCents: number,
  context: string,
  reference?: string | null,
): Promise<{ feeCents: number; creditApplied: number }> {
  const safeFee = Math.max(0, Math.round(feeCents || 0));
  if (!merchantId || safeFee <= 0) {
    return { feeCents: safeFee, creditApplied: 0 };
  }

  try {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("user_id")
      .eq("id", merchantId)
      .maybeSingle();

    const ownerId = merchant?.user_id;
    if (!ownerId) return { feeCents: safeFee, creditApplied: 0 };

    const { data: applied, error } = await supabaseAdmin.rpc(
      "consume_pet_pro_referral_credit",
      {
        _user_id: ownerId,
        _fee_cents: safeFee,
        _context: context,
        _reference: reference ?? null,
      },
    );

    if (error) {
      console.error("[REFERRAL-CREDIT] rpc error", error);
      return { feeCents: safeFee, creditApplied: 0 };
    }

    const creditApplied = Math.max(0, Math.min(safeFee, Number(applied) || 0));
    if (creditApplied > 0) {
      console.log("[REFERRAL-CREDIT] applied", {
        ownerId,
        context,
        feeCents: safeFee,
        creditApplied,
      });
    }

    return { feeCents: safeFee - creditApplied, creditApplied };
  } catch (e) {
    console.error("[REFERRAL-CREDIT] exception", e);
    return { feeCents: safeFee, creditApplied: 0 };
  }
}

/** Same as above but resolved directly from the Pet Pro's user id. */
export async function applyReferralCreditToFeeForUser(
  supabaseAdmin: any,
  ownerId: string | null | undefined,
  feeCents: number,
  context: string,
  reference?: string | null,
): Promise<{ feeCents: number; creditApplied: number }> {
  const safeFee = Math.max(0, Math.round(feeCents || 0));
  if (!ownerId || safeFee <= 0) return { feeCents: safeFee, creditApplied: 0 };

  try {
    const { data: applied, error } = await supabaseAdmin.rpc(
      "consume_pet_pro_referral_credit",
      {
        _user_id: ownerId,
        _fee_cents: safeFee,
        _context: context,
        _reference: reference ?? null,
      },
    );
    if (error) {
      console.error("[REFERRAL-CREDIT] rpc error", error);
      return { feeCents: safeFee, creditApplied: 0 };
    }
    const creditApplied = Math.max(0, Math.min(safeFee, Number(applied) || 0));
    return { feeCents: safeFee - creditApplied, creditApplied };
  } catch (e) {
    console.error("[REFERRAL-CREDIT] exception", e);
    return { feeCents: safeFee, creditApplied: 0 };
  }
}

/**
 * Applies a Pet Pro's referral credit to the Success Fee that was already
 * collected on a successful Connect payment, by refunding that portion of the
 * application fee back to the merchant's connected account.
 *
 * Runs after the payment succeeds, so credit is never spent on abandoned or
 * failed checkouts. Keyed on the PaymentIntent id, so webhook retries are safe.
 */
export async function applyReferralCreditToCollectedFee(
  stripe: any,
  supabaseAdmin: any,
  opts: {
    merchantId: string | null | undefined;
    paymentIntent: any;
    feeCents: number;
    context: string;
  },
): Promise<number> {
  const { merchantId, paymentIntent, context } = opts;
  const feeCents = Math.max(0, Math.round(opts.feeCents || 0));
  if (!merchantId || feeCents <= 0 || !paymentIntent?.id) return 0;

  const reference = `pi:${paymentIntent.id}`;
  let ownerId: string | null = null;
  let applied = 0;

  try {
    const { data: merchant } = await supabaseAdmin
      .from("merchants")
      .select("user_id")
      .eq("id", merchantId)
      .maybeSingle();
    ownerId = merchant?.user_id ?? null;
    if (!ownerId) return 0;

    // Skip the Stripe lookups entirely when there is no credit to spend.
    const { data: creditRow } = await supabaseAdmin
      .from("pet_pro_referral_credits")
      .select("balance_cents")
      .eq("user_id", ownerId)
      .maybeSingle();
    if (!creditRow || (creditRow.balance_cents || 0) <= 0) return 0;

    // Locate the application fee collected on this payment.
    const chargeId =
      (typeof paymentIntent.latest_charge === "string"
        ? paymentIntent.latest_charge
        : paymentIntent.latest_charge?.id) || null;
    if (!chargeId) {
      console.log("[REFERRAL-CREDIT] no charge on payment intent", { pi: paymentIntent.id });
      return 0;
    }

    const fees = await stripe.applicationFees.list({ charge: chargeId, limit: 1 });
    const fee = fees?.data?.[0];
    if (!fee?.id) {
      console.log("[REFERRAL-CREDIT] no application fee found", { chargeId });
      return 0;
    }

    const refundable = Math.max(0, (fee.amount || 0) - (fee.amount_refunded || 0));
    const target = Math.min(feeCents, refundable);
    if (target <= 0) return 0;

    const { data: consumed, error: rpcError } = await supabaseAdmin.rpc(
      "consume_pet_pro_referral_credit",
      { _user_id: ownerId, _fee_cents: target, _context: context, _reference: reference },
    );
    if (rpcError) {
      console.error("[REFERRAL-CREDIT] consume error", rpcError);
      return 0;
    }

    applied = Math.max(0, Math.min(target, Number(consumed) || 0));
    if (applied <= 0) return 0;

    await stripe.applicationFees.createRefund(fee.id, { amount: applied });

    console.log("[REFERRAL-CREDIT] Success Fee offset by referral credit", {
      ownerId,
      feeId: fee.id,
      applied,
      context,
    });

    return applied;
  } catch (e) {
    console.error("[REFERRAL-CREDIT] fee offset failed", e);
    // Give the credit back so a later payment can use it.
    if (ownerId && applied > 0) {
      try {
        await supabaseAdmin.rpc("credit_pet_pro_referral_usd", {
          _user_id: ownerId,
          _amount_cents: applied,
        });
        await supabaseAdmin
          .from("pet_pro_referral_credit_usage")
          .update({ reference: null, context: `reversed:${context}` })
          .eq("reference", reference);
      } catch (revertErr) {
        console.error("[REFERRAL-CREDIT] reversal failed", revertErr);
      }
    }
    return 0;
  }
}
