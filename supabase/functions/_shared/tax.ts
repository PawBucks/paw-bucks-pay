// ============================================================================
// PawBucks — Shared Sales Tax Engine (Stripe Tax)
// ============================================================================
// Single authoritative, SERVER-SIDE tax engine used by every checkout path.
//
// Design rules (do not violate):
//  - NO hard-coded tax rates or jurisdiction tables anywhere. All rates and
//    jurisdictions come from Stripe Tax.
//  - Taxability is decided per line item via its tax category -> Stripe tax
//    code mapping (public.tax_categories). Unmapped items are FLAGGED for
//    administrative review, never guessed.
//  - PawBucks redemptions never reduce the taxable amount. Tax is computed on
//    the merchandise/service value of the sale.
//  - Tax is never treated as merchant revenue or platform revenue. It is
//    tracked separately in public.tax_calculations.
//  - Tax liability follows the admin-controlled `tax_collection_mode` setting
//    (marketplace | merchant | platform). No legal conclusions in code.
// ============================================================================

export type TaxCollectionMode = "marketplace" | "merchant" | "platform";

export interface TaxConfig {
  enabled: boolean;
  mode: TaxCollectionMode;
  blockOnFailure: boolean;
}

export interface TaxAddress {
  line1: string;
  line2?: string | null;
  city: string;
  state: string;
  postal_code: string;
  country?: string | null;
}

export type TaxSourceType =
  | "catalog_item"
  | "pet_store_item"
  | "merchant_service"
  | "market_service"
  | "custom";

export interface TaxLineInput {
  source_type: TaxSourceType | string;
  source_id?: string | null;
  name: string;
  quantity?: number;
  /** Unit price in USD (not cents). */
  unit_price: number;
  /** Optional explicit category override (rarely needed). */
  tax_category_key?: string | null;
}

export interface ResolvedTaxLine extends TaxLineInput {
  reference: string;
  amount_cents: number;
  tax_category_key: string | null;
  stripe_tax_code: string | null;
  tax_behavior: "exclusive" | "inclusive";
  taxable: boolean;
  needs_review: boolean;
}

export interface TaxCalculationResult {
  /** Row id in public.tax_calculations. */
  taxCalculationId: string;
  stripeTaxCalculationId: string | null;
  mode: TaxCollectionMode;
  subtotalCents: number;
  taxableAmountCents: number;
  exemptAmountCents: number;
  taxAmountCents: number;
  totalCents: number;
  effectiveTaxRate: number | null;
  jurisdictions: unknown[];
  /** Customer-facing label, e.g. "Sales Tax". */
  taxLabel: string;
  lines: Array<{
    reference: string;
    name: string;
    amount_cents: number;
    tax_amount_cents: number;
    taxable: boolean;
  }>;
}

/** Thrown when tax cannot be determined. Never leaks Stripe internals. */
export class TaxUnavailableError extends Error {
  code: "needs_review" | "invalid_address" | "calculation_failed" | "missing_address";
  constructor(
    code: TaxUnavailableError["code"],
    /** Internal detail — logged server-side only. */
    public detail?: string,
  ) {
    super(customerMessageFor(code));
    this.code = code;
    this.name = "TaxUnavailableError";
  }
}

export function customerMessageFor(code: TaxUnavailableError["code"]): string {
  switch (code) {
    case "missing_address":
      return "We need your address to calculate sales tax before completing this purchase.";
    case "invalid_address":
      return "We couldn't verify that address. Please check the street, city, state and ZIP and try again.";
    case "needs_review":
      return "One or more items in this order need to be reviewed before we can complete the sale. Please contact support.";
    default:
      return "We couldn't calculate sales tax right now. Please try again in a moment.";
  }
}

const log = (step: string, details?: Record<string, unknown>) => {
  console.log(`[TAX] ${step}`, details ? JSON.stringify(details) : "");
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

function readSetting(value: unknown, fallback: boolean): boolean {
  if (value == null) return fallback;
  if (typeof value === "boolean") return value;
  if (typeof value === "string") return value === "true";
  if (typeof value === "object" && value !== null && "enabled" in (value as any)) {
    return Boolean((value as any).enabled);
  }
  return fallback;
}

export async function getTaxConfig(admin: any): Promise<TaxConfig> {
  const { data } = await admin
    .from("platform_settings")
    .select("key, value")
    .in("key", ["tax_engine_enabled", "tax_collection_mode", "tax_block_on_failure"]);

  const map = new Map<string, unknown>((data ?? []).map((r: any) => [r.key, r.value]));
  const rawMode = map.get("tax_collection_mode");
  const mode = (typeof rawMode === "string" ? rawMode : (rawMode as any)?.mode) as TaxCollectionMode;

  return {
    enabled: readSetting(map.get("tax_engine_enabled"), false),
    mode: mode === "marketplace" || mode === "platform" ? mode : "merchant",
    blockOnFailure: readSetting(map.get("tax_block_on_failure"), true),
  };
}

// ---------------------------------------------------------------------------
// Address handling
// ---------------------------------------------------------------------------

const US_STATE = /^[A-Za-z]{2}$/;
const US_ZIP = /^\d{5}(-\d{4})?$/;

/**
 * Structural validation only. Jurisdiction determination is always Stripe's.
 * We never infer a rate from a ZIP code.
 */
export function validateTaxAddress(address: Partial<TaxAddress> | null | undefined): {
  valid: boolean;
  reason?: string;
  normalized?: TaxAddress;
} {
  if (!address) return { valid: false, reason: "missing" };
  const country = (address.country || "US").toUpperCase();
  const line1 = (address.line1 || "").trim();
  const city = (address.city || "").trim();
  const state = (address.state || "").trim();
  const postal = (address.postal_code || "").trim();

  if (!line1) return { valid: false, reason: "line1_required" };
  if (!city) return { valid: false, reason: "city_required" };
  if (!state) return { valid: false, reason: "state_required" };
  if (!postal) return { valid: false, reason: "postal_code_required" };
  if (country === "US" && !US_STATE.test(state)) return { valid: false, reason: "state_invalid" };
  if (country === "US" && !US_ZIP.test(postal)) return { valid: false, reason: "postal_code_invalid" };

  return {
    valid: true,
    normalized: {
      line1,
      line2: (address.line2 || "").trim() || null,
      city,
      state: country === "US" ? state.toUpperCase() : state,
      postal_code: postal,
      country,
    },
  };
}

/** Resolve the transaction location: explicit address > saved default. */
export async function resolveTaxAddress(
  admin: any,
  params: {
    userId: string;
    provided?: Partial<TaxAddress> | null;
    preferKind?: "shipping" | "service" | "billing";
  },
): Promise<TaxAddress> {
  if (params.provided) {
    const v = validateTaxAddress(params.provided);
    if (!v.valid) throw new TaxUnavailableError("invalid_address", v.reason);
    return v.normalized!;
  }

  const kinds = params.preferKind
    ? [params.preferKind, "shipping", "service", "billing"]
    : ["shipping", "service", "billing"];

  const { data: rows } = await admin
    .from("customer_tax_addresses")
    .select("*")
    .eq("user_id", params.userId)
    .order("is_default", { ascending: false })
    .order("updated_at", { ascending: false });

  if (!rows || rows.length === 0) throw new TaxUnavailableError("missing_address");

  for (const kind of kinds) {
    const match = rows.find((r: any) => r.kind === kind);
    if (match) {
      const v = validateTaxAddress(match);
      if (v.valid) return v.normalized!;
    }
  }
  const v = validateTaxAddress(rows[0]);
  if (!v.valid) throw new TaxUnavailableError("invalid_address", v.reason);
  return v.normalized!;
}

// ---------------------------------------------------------------------------
// Tax code resolution
// ---------------------------------------------------------------------------

const SOURCE_TABLE: Record<string, string> = {
  pet_store_item: "pet_store_items",
  merchant_service: "merchant_services",
  catalog_item: "invoice_catalog_items",
  market_service: "merchant_market_services",
};

export async function resolveTaxLines(
  admin: any,
  items: TaxLineInput[],
): Promise<ResolvedTaxLine[]> {
  const { data: categories } = await admin
    .from("tax_categories")
    .select("key, stripe_tax_code, requires_review, active");
  const catMap = new Map<string, any>((categories ?? []).map((c: any) => [c.key, c]));

  // Batch-load tax config for each referenced catalog row.
  const bySource = new Map<string, Set<string>>();
  for (const it of items) {
    const table = SOURCE_TABLE[it.source_type];
    if (!table || !it.source_id) continue;
    if (!bySource.has(table)) bySource.set(table, new Set());
    bySource.get(table)!.add(it.source_id);
  }

  const itemConfig = new Map<string, any>();
  for (const [table, ids] of bySource.entries()) {
    const { data } = await admin
      .from(table)
      .select("id, tax_category_key, tax_behavior, taxable, tax_review_required")
      .in("id", Array.from(ids));
    for (const row of data ?? []) itemConfig.set(`${table}:${row.id}`, row);
  }

  return items.map((it, idx) => {
    const table = SOURCE_TABLE[it.source_type];
    const cfg = table && it.source_id ? itemConfig.get(`${table}:${it.source_id}`) : undefined;

    const categoryKey = it.tax_category_key ?? cfg?.tax_category_key ?? null;
    const category = categoryKey ? catMap.get(categoryKey) : undefined;

    const behavior = (cfg?.tax_behavior === "inclusive" ? "inclusive" : "exclusive") as
      | "inclusive"
      | "exclusive";

    // Explicit per-item override wins; otherwise the category decides.
    let taxable: boolean;
    let needsReview = false;
    let taxCode: string | null = null;

    if (cfg?.taxable === false || categoryKey === "nontaxable_exempt") {
      taxable = false;
    } else if (!category || category.active === false) {
      // No confident classification -> flag, never guess.
      taxable = false;
      needsReview = true;
    } else if (category.requires_review || !category.stripe_tax_code) {
      taxable = false;
      needsReview = true;
    } else {
      taxable = true;
      taxCode = category.stripe_tax_code;
    }

    const qty = it.quantity && it.quantity > 0 ? it.quantity : 1;
    return {
      ...it,
      reference: `${it.source_type}:${it.source_id ?? idx}:${idx}`,
      amount_cents: Math.round(it.unit_price * qty * 100),
      tax_category_key: categoryKey,
      stripe_tax_code: taxCode,
      tax_behavior: behavior,
      taxable,
      needs_review: needsReview,
    };
  });
}

/** Best-effort: mark unclassified catalog rows for administrative review. */
async function flagForReview(admin: any, lines: ResolvedTaxLine[]): Promise<void> {
  const flagged = lines.filter((l) => l.needs_review && l.source_id && SOURCE_TABLE[l.source_type]);
  await Promise.all(
    flagged.map((l) =>
      admin
        .from(SOURCE_TABLE[l.source_type])
        .update({ tax_review_required: true })
        .eq("id", l.source_id)
        .then(() => undefined, () => undefined),
    ),
  );
}

// ---------------------------------------------------------------------------
// Calculation
// ---------------------------------------------------------------------------

export interface CalculateTaxParams {
  stripe: any;
  admin: any;
  config: TaxConfig;
  userId: string;
  merchantId?: string | null;
  connectedAccountId?: string | null;
  context: "merchant_payment" | "pet_store" | "invoice" | "market_service" | "direct_charge";
  items: TaxLineInput[];
  address?: Partial<TaxAddress> | null;
  addressSource?: "billing" | "shipping";
  currency?: string;
  /** Amounts that are never taxable (e.g. tips) are simply not passed in. */
}

/**
 * Calculates tax via Stripe Tax and persists the audit record.
 * Returns null when the tax engine is disabled or nothing is taxable and no
 * review is required (caller then proceeds with zero tax).
 */
export async function calculateTax(
  params: CalculateTaxParams,
): Promise<TaxCalculationResult | null> {
  const { stripe, admin, config } = params;
  const currency = params.currency || "usd";

  if (!config.enabled) {
    log("Engine disabled — skipping tax calculation");
    return null;
  }

  const lines = await resolveTaxLines(admin, params.items);
  const subtotalCents = lines.reduce((s, l) => s + l.amount_cents, 0);

  if (lines.some((l) => l.needs_review)) {
    await flagForReview(admin, lines);
    log("Items require tax review", {
      refs: lines.filter((l) => l.needs_review).map((l) => l.reference),
    });
    if (config.blockOnFailure) throw new TaxUnavailableError("needs_review");
  }

  const taxableLines = lines.filter((l) => l.taxable && l.amount_cents > 0);
  const exemptCents = lines
    .filter((l) => !l.taxable)
    .reduce((s, l) => s + l.amount_cents, 0);

  if (taxableLines.length === 0) {
    log("No taxable lines — zero tax", { subtotalCents, exemptCents });
    return await persistCalculation({
      admin,
      params,
      currency,
      mode: config.mode,
      lines,
      stripeCalculation: null,
      subtotalCents,
      taxableCents: 0,
      exemptCents,
      taxCents: 0,
      status: "committed",
    });
  }

  const address = await resolveTaxAddress(admin, {
    userId: params.userId,
    provided: params.address,
    preferKind: params.addressSource === "shipping" ? "shipping" : undefined,
  });

  // Liability follows the configured collection mode. In `merchant` mode the
  // calculation is created ON the connected account so the tax transaction
  // lands in the merchant's Stripe Tax reporting; in `marketplace`/`platform`
  // mode it is created on the PawBucks platform account.
  const requestOptions =
    config.mode === "merchant" && params.connectedAccountId
      ? { stripeAccount: params.connectedAccountId }
      : undefined;

  let calculation: any;
  try {
    calculation = await stripe.tax.calculations.create(
      {
        currency,
        customer_details: {
          address: {
            line1: address.line1,
            line2: address.line2 ?? undefined,
            city: address.city,
            state: address.state,
            postal_code: address.postal_code,
            country: address.country || "US",
          },
          address_source: params.addressSource || "billing",
        },
        line_items: taxableLines.map((l) => ({
          amount: l.amount_cents,
          reference: l.reference,
          tax_code: l.stripe_tax_code!,
          tax_behavior: l.tax_behavior,
          quantity: 1,
        })),
        expand: ["line_items"],
      },
      requestOptions,
    );
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    log("Stripe Tax calculation failed", { detail });

    await persistCalculation({
      admin,
      params,
      currency,
      mode: config.mode,
      lines,
      stripeCalculation: null,
      subtotalCents,
      taxableCents: taxableLines.reduce((s, l) => s + l.amount_cents, 0),
      exemptCents,
      taxCents: 0,
      status: "failed",
      errorMessage: detail,
    });

    const isAddress = /address|location|postal|state/i.test(detail);
    throw new TaxUnavailableError(isAddress ? "invalid_address" : "calculation_failed", detail);
  }

  const taxCents = Number(calculation.tax_amount_exclusive ?? 0);
  const taxableCents = taxableLines.reduce((s, l) => s + l.amount_cents, 0);

  log("Stripe Tax calculated", {
    calculationId: calculation.id,
    taxCents,
    taxableCents,
    exemptCents,
    mode: config.mode,
  });

  return await persistCalculation({
    admin,
    params,
    currency,
    mode: config.mode,
    lines,
    stripeCalculation: calculation,
    subtotalCents,
    taxableCents,
    exemptCents,
    taxCents,
    status: "pending",
  });
}

function jurisdictionsFrom(calculation: any): unknown[] {
  const breakdown = calculation?.tax_breakdown ?? [];
  return breakdown.map((b: any) => ({
    display_name: b?.jurisdiction?.display_name ?? b?.tax_rate_details?.tax_type ?? "Unknown",
    level: b?.jurisdiction?.level ?? null,
    country: b?.jurisdiction?.country ?? null,
    state: b?.jurisdiction?.state ?? null,
    percentage_decimal: b?.tax_rate_details?.percentage_decimal ?? null,
    amount: b?.amount ?? null,
    tax_type: b?.tax_rate_details?.tax_type ?? null,
  }));
}

function taxLabelFrom(calculation: any): string {
  const type = calculation?.tax_breakdown?.[0]?.tax_rate_details?.tax_type;
  if (typeof type === "string" && type.length > 0) {
    if (type === "sales_tax") return "Sales Tax";
    return type
      .split("_")
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1))
      .join(" ");
  }
  return "Sales Tax";
}

async function persistCalculation(args: {
  admin: any;
  params: CalculateTaxParams;
  currency: string;
  mode: TaxCollectionMode;
  lines: ResolvedTaxLine[];
  stripeCalculation: any | null;
  subtotalCents: number;
  taxableCents: number;
  exemptCents: number;
  taxCents: number;
  status: "pending" | "committed" | "failed";
  errorMessage?: string;
}): Promise<TaxCalculationResult> {
  const { admin, params, stripeCalculation } = args;

  const stripeLines: any[] = stripeCalculation?.line_items?.data ?? [];
  const lineTaxByRef = new Map<string, any>(
    stripeLines.map((l: any) => [l.reference, l]),
  );

  const { data: row, error } = await admin
    .from("tax_calculations")
    .insert({
      stripe_tax_calculation_id: stripeCalculation?.id ?? null,
      connected_account_id: params.connectedAccountId ?? null,
      user_id: params.userId,
      merchant_id: params.merchantId ?? null,
      context: params.context,
      tax_collection_mode: args.mode,
      currency: args.currency,
      subtotal_cents: args.subtotalCents,
      taxable_amount_cents: args.taxableCents,
      exempt_amount_cents: args.exemptCents,
      tax_amount_cents: args.taxCents,
      total_cents: args.subtotalCents + args.taxCents,
      effective_tax_rate:
        args.taxableCents > 0 ? Number((args.taxCents / args.taxableCents).toFixed(6)) : null,
      address: stripeCalculation?.customer_details?.address ?? null,
      jurisdictions: jurisdictionsFrom(stripeCalculation),
      stripe_response: stripeCalculation
        ? {
            id: stripeCalculation.id,
            expires_at: stripeCalculation.expires_at ?? null,
            amount_total: stripeCalculation.amount_total ?? null,
            tax_amount_exclusive: stripeCalculation.tax_amount_exclusive ?? null,
            tax_amount_inclusive: stripeCalculation.tax_amount_inclusive ?? null,
            tax_breakdown: stripeCalculation.tax_breakdown ?? null,
            customer_details: stripeCalculation.customer_details ?? null,
          }
        : null,
      status: args.status,
      error_message: args.errorMessage ?? null,
      expires_at: stripeCalculation?.expires_at
        ? new Date(stripeCalculation.expires_at * 1000).toISOString()
        : null,
    })
    .select("id")
    .single();

  if (error) throw new Error(`Failed to persist tax calculation: ${error.message}`);

  const lineRows = args.lines.map((l) => {
    const sl = lineTaxByRef.get(l.reference);
    const taxAmount = Number(sl?.amount_tax ?? 0);
    const breakdown = sl?.tax_breakdown ?? null;
    return {
      tax_calculation_id: row.id,
      stripe_line_item_id: sl?.id ?? null,
      reference: l.reference,
      source_type: l.source_type,
      source_id: l.source_id ?? null,
      name: l.name,
      tax_category_key: l.tax_category_key,
      stripe_tax_code: l.stripe_tax_code,
      tax_behavior: l.tax_behavior,
      quantity: l.quantity ?? 1,
      amount_cents: l.amount_cents,
      taxable_amount_cents: l.taxable ? l.amount_cents : 0,
      tax_amount_cents: taxAmount,
      tax_rate:
        l.taxable && l.amount_cents > 0
          ? Number((taxAmount / l.amount_cents).toFixed(6))
          : null,
      jurisdiction: breakdown?.[0]?.jurisdiction ?? null,
      tax_breakdown: breakdown,
    };
  });

  if (lineRows.length > 0) {
    await admin.from("tax_calculation_line_items").insert(lineRows);
  }

  return {
    taxCalculationId: row.id,
    stripeTaxCalculationId: stripeCalculation?.id ?? null,
    mode: args.mode,
    subtotalCents: args.subtotalCents,
    taxableAmountCents: args.taxableCents,
    exemptAmountCents: args.exemptCents,
    taxAmountCents: args.taxCents,
    totalCents: args.subtotalCents + args.taxCents,
    effectiveTaxRate:
      args.taxableCents > 0 ? Number((args.taxCents / args.taxableCents).toFixed(6)) : null,
    jurisdictions: jurisdictionsFrom(stripeCalculation),
    taxLabel: taxLabelFrom(stripeCalculation),
    lines: args.lines.map((l) => ({
      reference: l.reference,
      name: l.name,
      amount_cents: l.amount_cents,
      tax_amount_cents: Number(lineTaxByRef.get(l.reference)?.amount_tax ?? 0),
      taxable: l.taxable,
    })),
  };
}

// ---------------------------------------------------------------------------
// Linking + commit + reversal
// ---------------------------------------------------------------------------

export async function linkTaxCalculation(
  admin: any,
  taxCalculationId: string,
  refs: {
    stripePaymentIntentId?: string | null;
    transactionId?: string | null;
    orderId?: string | null;
    invoiceId?: string | null;
  },
): Promise<void> {
  if (!taxCalculationId) return;
  await admin
    .from("tax_calculations")
    .update({
      stripe_payment_intent_id: refs.stripePaymentIntentId ?? undefined,
      transaction_id: refs.transactionId ?? undefined,
      order_id: refs.orderId ?? undefined,
      invoice_id: refs.invoiceId ?? undefined,
    })
    .eq("id", taxCalculationId);
}

/**
 * Commits a calculation into a Stripe Tax transaction once payment succeeded.
 * Idempotent: already-committed rows are skipped.
 */
export async function commitTaxCalculation(
  stripe: any,
  admin: any,
  params: {
    taxCalculationId?: string | null;
    stripePaymentIntentId?: string | null;
    reference?: string;
  },
): Promise<void> {
  try {
    let query = admin.from("tax_calculations").select("*").limit(1);
    if (params.taxCalculationId) query = query.eq("id", params.taxCalculationId);
    else if (params.stripePaymentIntentId)
      query = query.eq("stripe_payment_intent_id", params.stripePaymentIntentId);
    else return;

    const { data: rows } = await query;
    const row = rows?.[0];
    if (!row) return;
    if (row.status === "committed" || row.stripe_tax_transaction_id) return;

    // Nothing taxable — mark committed without calling Stripe.
    if (!row.stripe_tax_calculation_id || row.tax_amount_cents === 0) {
      await admin
        .from("tax_calculations")
        .update({ status: "committed" })
        .eq("id", row.id);
      return;
    }

    const options = row.tax_collection_mode === "merchant" && row.connected_account_id
      ? { stripeAccount: row.connected_account_id }
      : undefined;

    const txn = await stripe.tax.transactions.createFromCalculation(
      {
        calculation: row.stripe_tax_calculation_id,
        reference: params.reference || row.id,
      },
      options,
    );

    await admin
      .from("tax_calculations")
      .update({ stripe_tax_transaction_id: txn.id, status: "committed" })
      .eq("id", row.id);

    log("Tax transaction committed", { taxCalculationId: row.id, stripeTaxTransactionId: txn.id });
  } catch (err) {
    // Never fail the payment because of tax bookkeeping — log and flag.
    const detail = err instanceof Error ? err.message : String(err);
    log("ERROR committing tax transaction", { detail });
    if (params.taxCalculationId || params.stripePaymentIntentId) {
      const q = admin.from("tax_calculations").update({ error_message: detail });
      if (params.taxCalculationId) await q.eq("id", params.taxCalculationId);
      else await q.eq("stripe_payment_intent_id", params.stripePaymentIntentId);
    }
  }
}

export async function markTaxCalculationFailed(
  admin: any,
  params: { stripePaymentIntentId?: string | null; taxCalculationId?: string | null; reason?: string },
): Promise<void> {
  const update = { status: "failed", error_message: params.reason ?? null };
  if (params.taxCalculationId) {
    await admin.from("tax_calculations").update(update).eq("id", params.taxCalculationId);
  } else if (params.stripePaymentIntentId) {
    await admin
      .from("tax_calculations")
      .update(update)
      .eq("stripe_payment_intent_id", params.stripePaymentIntentId)
      .eq("status", "pending");
  }
}

/**
 * Records a proportional tax reversal for a refund/cancellation.
 * The original calculation record is preserved — never deleted.
 */
export async function reverseTaxForRefund(
  stripe: any,
  admin: any,
  params: {
    stripePaymentIntentId?: string | null;
    taxCalculationId?: string | null;
    /** Refunded merchandise amount in cents (excluding tax). */
    refundedTaxableCents?: number;
    /** Set when the whole sale was refunded/canceled. */
    full?: boolean;
    stripeRefundId?: string | null;
    reason?: string;
    createdBy?: string | null;
    cancellation?: boolean;
  },
): Promise<{ reversedTaxCents: number } | null> {
  try {
    let query = admin.from("tax_calculations").select("*").limit(1);
    if (params.taxCalculationId) query = query.eq("id", params.taxCalculationId);
    else if (params.stripePaymentIntentId)
      query = query.eq("stripe_payment_intent_id", params.stripePaymentIntentId);
    else return null;

    const { data: rows } = await query;
    const row = rows?.[0];
    if (!row || row.tax_amount_cents === 0) return null;

    const alreadyReversed = await admin
      .from("tax_reversals")
      .select("reversed_tax_amount_cents")
      .eq("tax_calculation_id", row.id);
    const previouslyReversed = (alreadyReversed.data ?? []).reduce(
      (s: number, r: any) => s + Number(r.reversed_tax_amount_cents || 0),
      0,
    );

    const isFull = params.full === true || params.cancellation === true;
    const refundedTaxable = isFull
      ? row.taxable_amount_cents
      : Math.max(0, Math.round(params.refundedTaxableCents ?? 0));

    // Proportional tax reversal — never a recomputed/guessed rate.
    const proportional =
      row.taxable_amount_cents > 0
        ? Math.round((row.tax_amount_cents * refundedTaxable) / row.taxable_amount_cents)
        : 0;
    const reversedTax = Math.max(
      0,
      Math.min(proportional, row.tax_amount_cents - previouslyReversed),
    );
    if (reversedTax === 0 && refundedTaxable === 0) return null;

    let reversalTxnId: string | null = null;
    if (row.stripe_tax_transaction_id) {
      const options = row.tax_collection_mode === "merchant" && row.connected_account_id
        ? { stripeAccount: row.connected_account_id }
        : undefined;
      try {
        const reversal = await stripe.tax.transactions.createReversal(
          isFull
            ? {
                mode: "full",
                original_transaction: row.stripe_tax_transaction_id,
                reference: `reversal-${row.id}-${params.stripeRefundId ?? Date.now()}`,
              }
            : {
                mode: "partial",
                original_transaction: row.stripe_tax_transaction_id,
                reference: `reversal-${row.id}-${params.stripeRefundId ?? Date.now()}`,
                flat_amount: -Math.abs(refundedTaxable + reversedTax),
              },
          options,
        );
        reversalTxnId = reversal.id;
      } catch (err) {
        log("Stripe Tax reversal failed (recording locally)", {
          detail: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await admin.from("tax_reversals").insert({
      tax_calculation_id: row.id,
      stripe_tax_transaction_id: row.stripe_tax_transaction_id,
      stripe_reversal_transaction_id: reversalTxnId,
      stripe_refund_id: params.stripeRefundId ?? null,
      mode: params.cancellation ? "cancellation" : isFull ? "full" : "partial",
      reversed_taxable_amount_cents: refundedTaxable,
      reversed_tax_amount_cents: reversedTax,
      reason: params.reason ?? null,
      created_by: params.createdBy ?? null,
    });

    const totalReversed = previouslyReversed + reversedTax;
    await admin
      .from("tax_calculations")
      .update({
        status: totalReversed >= row.tax_amount_cents ? "reversed" : "partially_reversed",
      })
      .eq("id", row.id);

    log("Tax reversal recorded", { taxCalculationId: row.id, reversedTax, isFull });
    return { reversedTaxCents: reversedTax };
  } catch (err) {
    log("ERROR reversing tax", { detail: err instanceof Error ? err.message : String(err) });
    return null;
  }
}
