/**
 * PawBucks Acceptance Cap helpers.
 *
 * Merchants/Vets can cap how much of a transaction's subtotal a customer
 * can pay with PawBucks. The cap is OFF by default — when off, no cap.
 *
 * Spec:
 *   • Selectable base caps: 10%, 20%, 30%
 *   • Per-type defaults when enabled but unset:
 *       - Veterinary  → 10%
 *       - Retail-ish  → 20%   (pet_store, food, delivery, insurance)
 *       - Services    → 30%   (grooming, boarding, training, etc.)
 *   • Optional temporary promo boost with explicit start/end timestamps.
 *     Hard ceiling 50% during a promo window.
 *   • Cap applies to the SUBTOTAL only (pre-tax/tip).
 */

export const PAWBUCKS_BASE_CAP_OPTIONS = [10, 20, 30] as const;
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
  "breeder","rescue_nonprofit","pet_waste_removal",
]);
const RETAIL = new Set(["pet_store","food","delivery","insurance"]);

export function defaultPawBucksCapPct(businessType?: string | null): number {
  if (!businessType) return 20;
  if (businessType === "veterinary") return 10;
  if (RETAIL.has(businessType)) return 20;
  if (SERVICES.has(businessType)) return 30;
  return 20;
}

/**
 * Returns the active cap percent in effect right now, or `null` when the
 * cap feature is off (no cap → customer can apply any amount of PawBucks).
 */
export function effectivePawBucksCapPct(
  m: MerchantCapFields,
  now: Date = new Date()
): number | null {
  if (!m?.pawbucks_cap_enabled) return null;

  // Active promo window?
  if (
    m.pawbucks_promo_cap_pct &&
    m.pawbucks_promo_starts_at &&
    m.pawbucks_promo_ends_at
  ) {
    const start = new Date(m.pawbucks_promo_starts_at).getTime();
    const end = new Date(m.pawbucks_promo_ends_at).getTime();
    const t = now.getTime();
    if (t >= start && t < end) {
      return Math.min(PAWBUCKS_PROMO_CAP_MAX, m.pawbucks_promo_cap_pct);
    }
  }

  return m.pawbucks_cap_pct ?? defaultPawBucksCapPct(m.business_type);
}

/**
 * Given a subtotal in USD and a merchant config, returns the maximum USD
 * value of PawBucks that may be applied. `null` cap = unlimited (returns subtotal).
 */
export function maxPawBucksUsdForSubtotal(
  subtotalUsd: number,
  m: MerchantCapFields,
  now: Date = new Date()
): number {
  const pct = effectivePawBucksCapPct(m, now);
  if (pct == null) return subtotalUsd;
  return Math.max(0, (subtotalUsd * pct) / 100);
}

export function isPromoActive(m: MerchantCapFields, now: Date = new Date()): boolean {
  if (!m?.pawbucks_promo_cap_pct || !m.pawbucks_promo_starts_at || !m.pawbucks_promo_ends_at) {
    return false;
  }
  const t = now.getTime();
  return (
    t >= new Date(m.pawbucks_promo_starts_at).getTime() &&
    t < new Date(m.pawbucks_promo_ends_at).getTime()
  );
}