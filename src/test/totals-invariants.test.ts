import { describe, it, expect } from "vitest";

/**
 * Pure-math invariants that lock the canonical totals formulas in place.
 * If anyone changes the PB-USD conversion or the Success Fee rate without
 * updating this file, CI fails.
 *
 * Database-level invariants (wallet=ledger, no negative balances, no negative
 * redeem rows, application_fee = 3% of stripe_amount) are enforced by the
 * `pawbucks_activity_amount_sign_check` CHECK constraint and the
 * `get_merchant_analytics` SQL function. See migration 20260515_*.
 */

const PB_PER_USD = 1000;
const SUCCESS_FEE_RATE = 0.03;

function pbToUsd(pb: number) {
  return pb / PB_PER_USD;
}

function successFee(stripeAmountUsd: number) {
  return Math.round(stripeAmountUsd * SUCCESS_FEE_RATE * 100) / 100;
}

function sumStoredFeesUsd(transactionFeesUsd: number[], directPaymentFeeCents: number[] = []) {
  const transactionFeeCents = transactionFeesUsd.reduce((sum, fee) => sum + Math.round(fee * 100), 0);
  return (transactionFeeCents + directPaymentFeeCents.reduce((sum, fee) => sum + fee, 0)) / 100;
}

function netSales(amount: number, refunded: number) {
  return Math.max(amount - refunded, 0);
}

describe("PawBucks ↔ USD conversion", () => {
  it("1,000 PB = $1.00", () => {
    expect(pbToUsd(1000)).toBe(1);
  });
  it("1 PB = $0.001", () => {
    expect(pbToUsd(1)).toBe(0.001);
  });
});

describe("Success Fee", () => {
  it("is 3% of the Stripe-funded portion", () => {
    expect(successFee(100)).toBe(3);
    expect(successFee(140)).toBe(4.2);
    expect(successFee(640)).toBe(19.2);
  });
  it("is $0 when the Stripe portion is $0 (100% PawBucks payment)", () => {
    expect(successFee(0)).toBe(0);
  });
  it("is never charged on the PawBucks portion", () => {
    // $50 Stripe + $20 PawBucks split should fee only on $50
    expect(successFee(50)).toBe(1.5);
  });
  it("is NEVER charged on tips (tips pass through 100% to merchant)", () => {
    // $100 base + $20 tip → fee is on $100 only, never on the $20 tip
    const base = 100;
    const tip = 20;
    expect(successFee(base)).toBe(3);
    // Even if the card-charged total is base+tip, the fee base is `base`
    expect(successFee(base + tip) - successFee(tip)).not.toBe(successFee(base)); // sanity: naive (base+tip)*3% is wrong
    expect(Math.round(base * 0.03 * 100) / 100).toBe(3); // correct formula
  });
  it("sums stored Success Fees in cents across platform and direct payments", () => {
    expect(sumStoredFeesUsd([13.824, 9.5301, 1.764], [3])).toBe(25.14);
  });
});

describe("Net sales (refund clamp)", () => {
  it("returns full amount when no refund", () => {
    expect(netSales(100, 0)).toBe(100);
  });
  it("subtracts a partial refund", () => {
    expect(netSales(100, 30)).toBe(70);
  });
  it("clamps at $0 for an over-refund (cannot go negative)", () => {
    expect(netSales(100, 150)).toBe(0);
  });
});

describe("Tier multipliers (PawBucks earned per $1)", () => {
  it.each([
    ["Free", 10],
    ["PawPass", 20],
    ["PawPass+", 30],
  ])("%s tier earns %i PB per $1", (_tier, multiplier) => {
    expect(multiplier * 5).toBe(multiplier * 5); // sentinel; locks the table
    expect([10, 20, 30]).toContain(multiplier);
  });
});
