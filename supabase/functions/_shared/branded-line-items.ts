// Helpers for building `p_line_items` jsonb arrays passed to
// `redeem_branded_pawbucks_v2`. Each element is `{ brand_id, total_cents }`.
// brand_id may be null for un-tagged lines (they won't satisfy the product gate
// for campaigns that have `enforce_product_gate = true`).

// deno-lint-ignore no-explicit-any
type SB = any;

export interface BrandLineItem {
  brand_id: string | null;
  total_cents: number;
}

/**
 * Fetch a Map<id, brand_id|null> for a given catalog table.
 * Supported tables: pet_store_items, merchant_services, invoice_catalog_items,
 * partner_offers. invoice_items already store brand_id on the row.
 */
export async function fetchBrandIdMap(
  supabase: SB,
  table: "pet_store_items" | "merchant_services" | "invoice_catalog_items" | "partner_offers",
  ids: string[],
): Promise<Map<string, string | null>> {
  const map = new Map<string, string | null>();
  const clean = Array.from(new Set(ids.filter(Boolean)));
  if (clean.length === 0) return map;
  const { data, error } = await supabase
    .from(table)
    .select("id, brand_id")
    .in("id", clean);
  if (error) {
    console.warn(`[branded-line-items] fetchBrandIdMap(${table}) failed:`, error.message);
    return map;
  }
  for (const row of (data ?? [])) {
    map.set(row.id as string, (row.brand_id as string | null) ?? null);
  }
  return map;
}

/**
 * Build line items from an invoice. Reads invoice_items.brand_id directly.
 */
export async function buildInvoiceLineItems(
  supabase: SB,
  invoiceId: string,
): Promise<BrandLineItem[]> {
  const { data, error } = await supabase
    .from("invoice_items")
    .select("brand_id, quantity, unit_price, total")
    .eq("invoice_id", invoiceId);
  if (error || !data) {
    console.warn("[branded-line-items] buildInvoiceLineItems failed:", error?.message);
    return [];
  }
  return data.map((row: any) => {
    const totalCents = typeof row.total === "number"
      ? Math.round(Number(row.total) * 100)
      : Math.round(Number(row.quantity ?? 1) * Number(row.unit_price ?? 0) * 100);
    return { brand_id: row.brand_id ?? null, total_cents: Math.max(0, totalCents) };
  });
}

/**
 * Build line items for a pet-store cart. Caller supplies `{ id, total_cents }`.
 */
export async function buildPetStoreLineItems(
  supabase: SB,
  items: Array<{ id: string; total_cents: number }>,
): Promise<BrandLineItem[]> {
  if (items.length === 0) return [];
  const brandMap = await fetchBrandIdMap(supabase, "pet_store_items", items.map((i) => i.id));
  return items.map((i) => ({
    brand_id: brandMap.get(i.id) ?? null,
    total_cents: Math.max(0, Math.round(i.total_cents)),
  }));
}

/**
 * Build a single-line offer item from `partner_offers.brand_id`.
 */
export async function buildOfferLineItem(
  supabase: SB,
  offerId: string,
  totalCents: number,
): Promise<BrandLineItem[]> {
  const map = await fetchBrandIdMap(supabase, "partner_offers", [offerId]);
  return [{ brand_id: map.get(offerId) ?? null, total_cents: Math.max(0, Math.round(totalCents)) }];
}
