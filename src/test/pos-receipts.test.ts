import { afterEach, describe, expect, it, vi } from "vitest";
import { posReceiptItems } from "../../supabase/functions/_shared/pos-receipt-data";
import { sendPosReceipts } from "../../supabase/functions/_shared/pos-receipts";

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

describe("POS receipt delivery", () => {
  afterEach(() => vi.unstubAllGlobals());
  function backend(status = "completed") {
    const rows: Record<string, unknown> = {
      merchant_pos_sales: { id: "sale-1", merchant_id: "business-1", total: 22.8, discount: 2, tax: 1.8, tip: 3, status, payment_method: "cash", created_at: "2026-10-16T12:00:00Z" },
      merchants: { user_id: "owner-1", email: "business@example.com", business_name: "Pet Shop" },
      profiles: { email: "owner@example.com" },
      merchant_pos_sale_items: [{ name: "Dog treats", quantity: 2, unit_price: 10, line_total: 20 }],
    };
    return { from: (table: string) => {
      const result = { data: rows[table], error: null };
      const query = { select: () => query, eq: () => query, maybeSingle: async () => result, single: async () => result, then: (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve) };
      return query;
    } };
  }
  it("sends the saved itemized ticket independently to both recipients", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "test-only" } });
    const payloads: Record<string, unknown>[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      payloads.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ success: true }));
    }));
    const result = await sendPosReceipts(backend() as unknown as Parameters<typeof sendPosReceipts>[0], "sale-1", { email: "customer@example.com" });
    expect(result.success).toBe(true);
    expect(payloads.map(p => p.email)).toEqual(["business@example.com", "customer@example.com"]);
    expect(payloads[0].items).toEqual(payloads[1].items);
    expect(payloads[0].idempotencyKey).not.toBe(payloads[1].idempotencyKey);
  });
  it("still sends the customer copy if merchant delivery fails", async () => {
    vi.stubGlobal("Deno", { env: { get: () => "test-only" } });
    vi.stubGlobal("fetch", vi.fn(async (_url, init) => {
      const payload = JSON.parse(init.body);
      return new Response(JSON.stringify({ success: payload.audience === "customer" }));
    }));
    const result = await sendPosReceipts(backend() as unknown as Parameters<typeof sendPosReceipts>[0], "sale-1", { email: "customer@example.com" });
    expect(result.merchant.status).toBe("failed");
    expect(result.customer.status).toBe("sent");
    expect(result.success).toBe(false);
  });
  it("rejects unfinished sales before any email is sent", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    await expect(sendPosReceipts(backend("awaiting_payment") as unknown as Parameters<typeof sendPosReceipts>[0], "sale-1")).rejects.toThrow("completed sales");
    expect(fetch).not.toHaveBeenCalled();
  });
});