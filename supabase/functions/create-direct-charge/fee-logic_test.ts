import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calculateApplicationFee } from "./fee-logic.ts";

// ---------------------------------------------------------------------------
// Full Ecosystem: flat 3% on EVERY transaction
// ---------------------------------------------------------------------------

Deno.test("Full Ecosystem: charges 3% on a new customer's first purchase", () => {
  const result = calculateApplicationFee({
    amount: 10_000, // $100.00
    feeModel: "full_ecosystem",
    isReturningCustomer: false,
  });

  assertEquals(result.applicationFee, 300); // 3% of $100 = $3.00
  assertEquals(result.feePercent, 0.03);
  assertEquals(result.isAcquisition, false); // acquisition flag only used for acquisition_only
});

Deno.test("Full Ecosystem: still charges 3% on a returning customer's purchase", () => {
  const result = calculateApplicationFee({
    amount: 5_000, // $50.00
    feeModel: "full_ecosystem",
    isReturningCustomer: true,
  });

  assertEquals(result.applicationFee, 150); // 3% of $50 = $1.50
  assertEquals(result.feePercent, 0.03);
});

Deno.test("Full Ecosystem: 3% applied across many varied purchase amounts", () => {
  const amounts = [50, 199, 1_000, 2_500, 9_999, 50_000, 123_456];
  for (const amount of amounts) {
    const result = calculateApplicationFee({
      amount,
      feeModel: "full_ecosystem",
      isReturningCustomer: Math.random() > 0.5, // shouldn't matter
    });
    assertEquals(
      result.applicationFee,
      Math.round(amount * 0.03),
      `Expected 3% fee for amount ${amount}`,
    );
    assertEquals(result.feePercent, 0.03);
  }
});

// ---------------------------------------------------------------------------
// Acquisition Only: fee on FIRST purchase only, then 0% on repeats
// ---------------------------------------------------------------------------

Deno.test("Acquisition Only: charges acquisition fee on the customer's first purchase", () => {
  const result = calculateApplicationFee({
    amount: 10_000, // $100.00
    feeModel: "acquisition_only",
    acquisitionFeeRate: 10, // default rate
    isReturningCustomer: false,
  });

  assertEquals(result.applicationFee, 1_000); // 10% of $100 = $10.00
  assertEquals(result.feePercent, 0.10);
  assertEquals(result.isAcquisition, true);
});

Deno.test("Acquisition Only: charges 0% on a returning customer's repeat purchases", () => {
  const result = calculateApplicationFee({
    amount: 10_000,
    feeModel: "acquisition_only",
    acquisitionFeeRate: 10,
    isReturningCustomer: true,
  });

  assertEquals(result.applicationFee, 0);
  assertEquals(result.feePercent, 0);
  assertEquals(result.isAcquisition, false);
});

Deno.test("Acquisition Only: respects a custom acquisition fee rate (15%)", () => {
  const result = calculateApplicationFee({
    amount: 20_000, // $200.00
    feeModel: "acquisition_only",
    acquisitionFeeRate: 15,
    isReturningCustomer: false,
  });

  assertEquals(result.applicationFee, 3_000); // 15% of $200 = $30.00
  assertEquals(result.feePercent, 0.15);
  assertEquals(result.isAcquisition, true);
});

Deno.test("Acquisition Only: defaults to 10% acquisition fee when rate is omitted", () => {
  const result = calculateApplicationFee({
    amount: 10_000,
    feeModel: "acquisition_only",
    isReturningCustomer: false,
  });

  assertEquals(result.applicationFee, 1_000);
  assertEquals(result.feePercent, 0.10);
});

Deno.test(
  "Acquisition Only: customer journey — fee on first purchase, then free for life",
  () => {
    const acquisitionFeeRate = 10;

    // Purchase 1: brand-new customer
    const first = calculateApplicationFee({
      amount: 5_000,
      feeModel: "acquisition_only",
      acquisitionFeeRate,
      isReturningCustomer: false,
    });
    assertEquals(first.applicationFee, 500); // 10% of $50
    assertEquals(first.isAcquisition, true);

    // Purchases 2..N: same customer, returning
    for (let i = 0; i < 5; i++) {
      const repeat = calculateApplicationFee({
        amount: 5_000 + i * 1_000,
        feeModel: "acquisition_only",
        acquisitionFeeRate,
        isReturningCustomer: true,
      });
      assertEquals(repeat.applicationFee, 0, `Repeat #${i + 2} should be fee-free`);
      assertEquals(repeat.isAcquisition, false);
    }
  },
);

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------

Deno.test("Edge: rounds half-cent fees to the nearest cent (Full Ecosystem)", () => {
  // $1.83 * 3% = 5.49 cents -> rounds to 5
  const a = calculateApplicationFee({
    amount: 183,
    feeModel: "full_ecosystem",
    isReturningCustomer: false,
  });
  assertEquals(a.applicationFee, 5);

  // $1.84 * 3% = 5.52 cents -> rounds to 6
  const b = calculateApplicationFee({
    amount: 184,
    feeModel: "full_ecosystem",
    isReturningCustomer: false,
  });
  assertEquals(b.applicationFee, 6);
});

Deno.test("Edge: minimum charge ($0.50) Full Ecosystem fee", () => {
  const result = calculateApplicationFee({
    amount: 50,
    feeModel: "full_ecosystem",
    isReturningCustomer: false,
  });
  // 3% of 50 cents = 1.5 cents -> rounds to 2
  assertEquals(result.applicationFee, 2);
});

Deno.test("Edge: 0% acquisition fee rate yields zero fee even on first purchase", () => {
  const result = calculateApplicationFee({
    amount: 10_000,
    feeModel: "acquisition_only",
    acquisitionFeeRate: 0,
    isReturningCustomer: false,
  });
  assertEquals(result.applicationFee, 0);
  assertEquals(result.isAcquisition, true);
});