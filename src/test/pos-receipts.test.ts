import { describe, expect, it } from "vitest";
import { posReceiptItems } from "../../supabase/functions/_shared/pos-receipt-data";

describe("POS itemized receipts", () => {
  const lines = [{ name: "Dog treats", quantity: 2, unit_price: "10.00", line_total: "20.00" }];
  it("preserves quantity and USD unit price for both recipients", () => {
    expect(posReceiptItems(lines, { discount: 0, tax: 0, tip: 0 })[0]).toEqual({ name: "Dog treats", qty: 2, unit_price: 10, price: 20 });
  });
  it("includes discount, sales tax, and USD tip exactly once", () => {
    const items = posReceiptItems(lines, { discount: 2, tax: 1.8, tip: 3 });
    expect(items.map(i => i.price)).toEqual([20, -2, 1.8, 3]);
    expect(items.reduce((sum, item) => sum + item.price, 0)).toBe(22.8);
  });
});