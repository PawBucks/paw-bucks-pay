// Shared helpers for inserting per-transaction line items
// (see public.transaction_items table).

// deno-lint-ignore no-explicit-any
type SB = any;

export interface IncomingTransactionItem {
  source_type: "catalog_item" | "pet_store_item" | "merchant_service" | "custom";
  source_id?: string | null;
  name: string;
  description?: string | null;
  sku?: string | null;
  quantity: number;
  unit_price: number;
  image_url?: string | null;
}

/**
 * Validate + insert items rows for a given transaction. Tolerant — items are
 * descriptive metadata, so a write failure logs a warning but never breaks
 * the payment flow.
 */
export async function insertTransactionItems(
  supabaseAdmin: SB,
  params: {
    transactionId: string;
    merchantId: string;
    items: IncomingTransactionItem[];
  },
): Promise<void> {
  const { transactionId, merchantId, items } = params;
  if (!items || items.length === 0) return;

  const rows = items
    .filter((i) =>
      i &&
      typeof i.name === "string" &&
      i.name.trim().length > 0 &&
      Number(i.quantity) > 0 &&
      Number(i.unit_price) >= 0
    )
    .slice(0, 100) // hard cap
    .map((i) => ({
      transaction_id: transactionId,
      merchant_id: merchantId,
      source_type: i.source_type ?? "custom",
      source_id: i.source_id ?? null,
      name: String(i.name).slice(0, 200),
      description: i.description ? String(i.description).slice(0, 1000) : null,
      sku: i.sku ? String(i.sku).slice(0, 80) : null,
      quantity: Number(i.quantity),
      unit_price: Number(i.unit_price),
      image_url: i.image_url ?? null,
    }));

  if (rows.length === 0) return;

  const { error } = await supabaseAdmin.from("transaction_items").insert(rows);
  if (error) {
    console.warn("[transaction-items] insert failed (non-fatal):", error.message);
  }
}

/**
 * Convert items into the simplified shape used by `send-receipt-email`.
 * Includes `qty` so the receipt can show "2 × Premium Bath" properly.
 */
export function itemsToReceiptItems(items: IncomingTransactionItem[]) {
  return (items || []).map((i) => ({
    name: i.name,
    price: Number(i.quantity) * Number(i.unit_price),
    qty: Number(i.quantity),
    unit_price: Number(i.unit_price),
  }));
}