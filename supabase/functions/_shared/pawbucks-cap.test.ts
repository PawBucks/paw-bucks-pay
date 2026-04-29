import {
  assertEquals,
  assert,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  effectivePawBucksCapPct,
  defaultPawBucksCapPct,
  isPromoActive,
  clampManualPawBucks,
  clampAutoRedeemPawBucks,
  type MerchantCapFields,
  PAWBUCKS_TO_USD,
} from "./pawbucks-cap.ts";

// Fixed reference time for deterministic tests
const NOW = new Date("2026-04-29T12:00:00Z");
const ONE_HOUR = 60 * 60 * 1000;

const baseMerchant: MerchantCapFields = {
  business_type: "pet_store",
  pawbucks_cap_enabled: false,
  pawbucks_cap_pct: null,
  pawbucks_promo_cap_pct: null,
  pawbucks_promo_starts_at: null,
  pawbucks_promo_ends_at: null,
};

// =====================================================================
// defaultPawBucksCapPct — per-business-type fallbacks
// =====================================================================
Deno.test("default cap: vet → 10%", () => {
  assertEquals(defaultPawBucksCapPct("veterinary"), 10);
});
Deno.test("default cap: retail (pet_store) → 20%", () => {
  assertEquals(defaultPawBucksCapPct("pet_store"), 20);
});
Deno.test("default cap: services (grooming) → 30%", () => {
  assertEquals(defaultPawBucksCapPct("grooming"), 30);
});
Deno.test("default cap: unknown type → 20%", () => {
  assertEquals(defaultPawBucksCapPct("other"), 20);
  assertEquals(defaultPawBucksCapPct(null), 20);
});

// =====================================================================
// effectivePawBucksCapPct
// =====================================================================
Deno.test("effective cap: feature OFF → null (no cap)", () => {
  assertEquals(effectivePawBucksCapPct(baseMerchant, NOW), null);
});

Deno.test("effective cap: enabled with explicit base pct uses that pct", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
  };
  assertEquals(effectivePawBucksCapPct(m, NOW), 20);
});

Deno.test("effective cap: enabled but unset falls back to type default (vet → 10)", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    business_type: "veterinary",
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: null,
  };
  assertEquals(effectivePawBucksCapPct(m, NOW), 10);
});

Deno.test("effective cap: promo INACTIVE (window in future) → base cap", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
    pawbucks_promo_cap_pct: 40,
    pawbucks_promo_starts_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + 2 * ONE_HOUR).toISOString(),
  };
  assertEquals(isPromoActive(m, NOW), false);
  assertEquals(effectivePawBucksCapPct(m, NOW), 20);
});

Deno.test("effective cap: promo ACTIVE → boosted pct overrides base", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
    pawbucks_promo_cap_pct: 40,
    pawbucks_promo_starts_at: new Date(NOW.getTime() - ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
  };
  assert(isPromoActive(m, NOW));
  assertEquals(effectivePawBucksCapPct(m, NOW), 40);
});

Deno.test("effective cap: promo ACTIVE but pct exceeds 50 → hard ceiling 50", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 30,
    pawbucks_promo_cap_pct: 80, // intentionally beyond ceiling
    pawbucks_promo_starts_at: new Date(NOW.getTime() - ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
  };
  assertEquals(effectivePawBucksCapPct(m, NOW), 50);
});

Deno.test("effective cap: promo ENDED → reverts to base cap", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 30,
    pawbucks_promo_cap_pct: 50,
    pawbucks_promo_starts_at: new Date(NOW.getTime() - 3 * ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() - ONE_HOUR).toISOString(),
  };
  assertEquals(isPromoActive(m, NOW), false);
  assertEquals(effectivePawBucksCapPct(m, NOW), 30);
});

// =====================================================================
// clampManualPawBucks — manual redemption clamping
// =====================================================================

// Helpers: 1 USD = 1000 PB. So $100 base × 20% = $20 = 20,000 PB.

Deno.test("manual clamp: cap OFF → request passes through unchanged", () => {
  const requested = 50_000; // $50
  assertEquals(
    clampManualPawBucks(requested, 100, baseMerchant, NOW),
    requested,
  );
});

Deno.test("manual clamp: 20% cap on $100 limits to 20,000 PB", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
  };
  // Request 80,000 PB ($80) on a $100 subtotal
  const result = clampManualPawBucks(80_000, 100, m, NOW);
  assertEquals(result, 20_000); // $20 cap = 20,000 PB
});

Deno.test("manual clamp: request below cap → unchanged", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 30,
  };
  // 5,000 PB ($5) on $100 subtotal — under the $30 cap
  assertEquals(clampManualPawBucks(5_000, 100, m, NOW), 5_000);
});

Deno.test("manual clamp: PROMO ACTIVE raises ceiling to 40%", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
    pawbucks_promo_cap_pct: 40,
    pawbucks_promo_starts_at: new Date(NOW.getTime() - ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
  };
  // $100 × 40% = $40 = 40,000 PB
  assertEquals(clampManualPawBucks(80_000, 100, m, NOW), 40_000);
});

Deno.test("manual clamp: PROMO INACTIVE → falls back to base 20% cap", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
    pawbucks_promo_cap_pct: 40,
    // Promo window in the future
    pawbucks_promo_starts_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + 2 * ONE_HOUR).toISOString(),
  };
  assertEquals(clampManualPawBucks(80_000, 100, m, NOW), 20_000);
});

Deno.test("manual clamp: vet default 10% on $200 → max 20,000 PB", () => {
  const m: MerchantCapFields = {
    business_type: "veterinary",
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: null, // unset → uses 10% default
  };
  assertEquals(clampManualPawBucks(50_000, 200, m, NOW), 20_000);
});

Deno.test("manual clamp: zero/negative inputs are safe", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
  };
  assertEquals(clampManualPawBucks(0, 100, m, NOW), 0);
  assertEquals(clampManualPawBucks(1000, 0, m, NOW), 1000); // base 0 → no clamp basis
});

// =====================================================================
// clampAutoRedeemPawBucks — auto-redeem clamping
// =====================================================================

Deno.test("auto clamp: cap OFF → only subtotal ceiling applies", () => {
  // $100 subtotal, propose 200,000 PB ($200) → must shrink to 100,000 PB ($100)
  assertEquals(
    clampAutoRedeemPawBucks(200_000, 100, baseMerchant, NOW),
    100_000,
  );
});

Deno.test("auto clamp: cap OFF, proposal under subtotal → unchanged", () => {
  assertEquals(
    clampAutoRedeemPawBucks(30_000, 100, baseMerchant, NOW),
    30_000,
  );
});

Deno.test("auto clamp: PROMO INACTIVE → base 20% cap binds before subtotal", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
    pawbucks_promo_cap_pct: 50,
    pawbucks_promo_starts_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + 2 * ONE_HOUR).toISOString(),
  };
  // Auto-redeem proposed 80,000 PB on $100 → cap binds at 20,000 PB
  assertEquals(clampAutoRedeemPawBucks(80_000, 100, m, NOW), 20_000);
});

Deno.test("auto clamp: PROMO ACTIVE → boosted 40% cap binds", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 20,
    pawbucks_promo_cap_pct: 40,
    pawbucks_promo_starts_at: new Date(NOW.getTime() - ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
  };
  // Same 80,000 PB proposal on $100 → 40,000 PB allowed during promo
  assertEquals(clampAutoRedeemPawBucks(80_000, 100, m, NOW), 40_000);
});

Deno.test("auto clamp: PROMO ACTIVE doesn't push above subtotal", () => {
  const m: MerchantCapFields = {
    ...baseMerchant,
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: 30,
    pawbucks_promo_cap_pct: 50,
    pawbucks_promo_starts_at: new Date(NOW.getTime() - ONE_HOUR).toISOString(),
    pawbucks_promo_ends_at: new Date(NOW.getTime() + ONE_HOUR).toISOString(),
  };
  // $10 subtotal × 50% = $5 = 5,000 PB. Proposal of 99,999 PB → 5,000.
  assertEquals(clampAutoRedeemPawBucks(99_999, 10, m, NOW), 5_000);
});

Deno.test("auto clamp: cap OFF, proposal exceeds subtotal at vet for $50", () => {
  const m: MerchantCapFields = {
    business_type: "veterinary",
    pawbucks_cap_enabled: false, // OFF — no cap
  };
  // $50 subtotal → max 50,000 PB regardless of vet default
  assertEquals(clampAutoRedeemPawBucks(999_999, 50, m, NOW), 50_000);
});

Deno.test("auto clamp: vet default 10% applied when enabled-but-unset", () => {
  const m: MerchantCapFields = {
    business_type: "veterinary",
    pawbucks_cap_enabled: true,
    pawbucks_cap_pct: null,
  };
  // $100 × 10% = $10 = 10,000 PB
  assertEquals(clampAutoRedeemPawBucks(50_000, 100, m, NOW), 10_000);
});

Deno.test("conversion sanity: PAWBUCKS_TO_USD is 0.001", () => {
  assertEquals(PAWBUCKS_TO_USD, 0.001);
});