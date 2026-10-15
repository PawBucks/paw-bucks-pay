import { describe, it, expect } from "vitest";
import { computeTicketTotals, addToTicket } from "@/lib/posTicket";

describe("POS ticket", () => {
  it("scanning the same item twice increments quantity", () => {
    let t = addToTicket([], { item_id: "a", name: "Kibble", price: 10 });
    t = addToTicket(t, { item_id: "a", name: "Kibble", price: 10 });
    expect(t).toHaveLength(1);
    expect(t[0].quantity).toBe(2);
  });
  it("discount cannot exceed subtotal and tax applies after discount", () => {
    const r = computeTicketTotals([{ item_id: "a", name: "x", price: 20, quantity: 2 }], 10, 10);
    expect(r).toEqual({ subtotal: 40, discount: 10, tax: 3, total: 33 });
    expect(computeTicketTotals([{ item_id: "a", name: "x", price: 5, quantity: 1 }], 99, 0).total).toBe(0);
  });
});
