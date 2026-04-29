/**
 * Server-side helpers for the merchant PawBucks Acceptance Cap.
 *
 * Mirrors the client helpers in `src/lib/pawbucksCap.ts` and the SQL
 * function `public.get_effective_pawbucks_cap_pct`.
 *
 * Spec:
 *   • Cap OFF → null (customer may apply any amount of PawBucks)
 *   • Selectable base caps: 10, 20, 30
 *   • Per-type defaults (when enabled but unset):
 *       - Veterinary    → 10
 *       - Retail-ish    → 20  (pet_store, food, delivery, insurance)
 *       - Services      → 30  (grooming, boarding, training, etc.)
 *   • Optional promo boost with explicit start/end timestamps.
 *     Hard ceiling 50% during a promo window.
 *   • Cap applies to the SUBTOTAL only (pre-tax/tip).
 */

export const PAWBUCKS_TO_USD = 0.001;
export const PAWBUCKS_PROMO_CAP_MAX = 50;

export type MerchantCapFields = {
  business_type?: string | null;
  pawbucks_cap_enabled?: boolean | null;
  pawbucks_cap_pct?: number | null;
  pawbucks_promo_cap_pct?: number | null;
  pawbucks_promo_starts_at?: string | null;
  pawbucks_promo_ends_at?: string | null;
};

const SERVICES = new Set([
  "grooming","mobile_groomer","boarding","training","walker","daycare",
  "sitter","photography","hiker","runner","masseuse","behaviorist",
  "breeder","rescue_nonprofit",
]);
const RETAIL = new Set(["pet_store","food","delivery","insurance"]);

export function defaultPawBucksCapPct(businessType?: string | null): number {
  if (!businessType) return 20;
  if (businessType === "veterinary") return 10;
  if (RETAIL.has(businessType)) return 20;
  if (SERVICES.has(businessType)) return 30;
  return 20;
}

export function isPromoActive(
  m: MerchantCapFields,
  now: Date = new Date(),
): boolean {
  if (!m?.pawbucks_promo_cap_pct || !m.pawbucks_promo_starts_at || !m.pawbucks_promo_ends_at) {
    return false;
  }
  const t = now.getTime();
  return (
    t >= new Date(m.pawbucks_promo_starts_at).getTime() &&
    t <  new Date(m.pawbucks_promo_ends_at).getTime()
  );
}

/** Returns the active cap percent right now, or `null` when disabled. */
export function effectivePawBucksCapPct(
  m: MerchantCapFields,
  now: Date = new Date(),
): number | null {
  if (!m?.pawbucks_cap_enabled) return null;
  if (isPromoActive(m, now) && m.pawbucks_promo_cap_pct) {
    return Math.min(PAWBUCKS_PROMO_CAP_MAX, m.pawbucks_promo_cap_pct);
  }
  return m.pawbucks_cap_pct ?? defaultPawBucksCapPct(m.business_type);
}

/**
 * Clamp a manual PawBucks redemption request to the merchant's cap.
 * Returns the (possibly reduced) PawBucks count.
 */
export function clampManualPawBucks(
  requestedPb: number,
  baseAmountUsd: number,
  m: MerchantCapFields,
  now: Date = new Date(),
): number {
  if (requestedPb <= 0 || baseAmountUsd <= 0) return Math.max(0, requestedPb);
  const pct = effectivePawBucksCapPct(m, now);
  if (pct == null) return requestedPb;
  const maxUsd = (baseAmountUsd * pct) / 100;
  const maxPb = Math.floor(maxUsd / PAWBUCKS_TO_USD);
  return Math.min(requestedPb, Math.max(0, maxPb));
}

/**
 * Auto-redeem clamp: given an already-computed auto-redeem PawBucks amount
 * and base subtotal, enforce both the subtotal ceiling AND the merchant cap.
 */
export function clampAutoRedeemPawBucks(
  proposedPb: number,
  baseAmountUsd: number,
  m: MerchantCapFields,
  now: Date = new Date(),
): number {
  if (proposedPb <= 0 || baseAmountUsd <= 0) return 0;

  // Never exceed the subtotal itself.
  let usd = proposedPb * PAWBUCKS_TO_USD;
  if (usd > baseAmountUsd) usd = baseAmountUsd;

  // Then apply merchant cap.
  const pct = effectivePawBucksCapPct(m, now);
  if (pct != null) {
    const merchantMaxUsd = (baseAmountUsd * pct) / 100;
    if (usd > merchantMaxUsd) usd = merchantMaxUsd;
  }

  return Math.max(0, Math.floor(usd / PAWBUCKS_TO_USD));
}