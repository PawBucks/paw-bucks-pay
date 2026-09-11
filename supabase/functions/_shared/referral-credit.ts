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
