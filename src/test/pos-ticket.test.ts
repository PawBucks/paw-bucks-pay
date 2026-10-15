import { describe, it, expect } from "vitest";
import { computeTicketTotals, addToTicket, tipFromPercent } from "@/lib/posTicket";

describe("POS ticket", () => {
  it("scanning the same item twice increments quantity", () => {
    let t = addToTicket([], { item_id: "a", name: "Kibble", price: 10 });
    t = addToTicket(t, { item_id: "a", name: "Kibble", price: 10 });
    expect(t).toHaveLength(1);
    expect(t[0].quantity).toBe(2);
  });
  it("discount cannot exceed subtotal and tax applies after discount", () => {
    const r = computeTicketTotals([{ item_id: "a", name: "x", price: 20, quantity: 2 }], 10, 10);
    expect(r).toEqual({ subtotal: 40, discount: 10, tax: 3, tip: 0, total: 33 });
    expect(computeTicketTotals([{ item_id: "a", name: "x", price: 5, quantity: 1 }], 99, 0).total).toBe(0);
  });
  it("tip is added to the total after tax", () => {
    const r = computeTicketTotals([{ item_id: "a", name: "x", price: 100, quantity: 1 }], 0, 10, 18);
    expect(r.total).toBe(128);
  });
  it("percent tip is based on subtotal after discount", () => {
    expect(tipFromPercent(100, 20, 15)).toBe(12);
  });
});
