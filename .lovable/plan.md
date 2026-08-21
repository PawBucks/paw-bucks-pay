# Automated Sales Tax (Stripe Tax) for PawBucks

## What already exists (inspection results)

**Stripe**: One integration, Connect **Direct Charges** (PaymentIntent created on the merchant's connected account, platform takes `application_fee_amount` = 3% Success Fee). SDK `stripe@18.5.0` via esm.sh, API version `2024-12-18.acacia`. Two webhook handlers only: `stripe-webhook` (platform) and `connect-webhook` (connected accounts). No Stripe Tax usage anywhere today — zero tax code in the codebase.

**Checkout paths that move money**
- `create-combined-payment` — the main pet-owner "Pay & Earn" flow (card, PawBucks-only, card+PawBucks, tips, caps, Pet Fund).
- `create-direct-charge` — simple merchant charge.
- `create-pet-store-payment` / `confirm-pet-store-payment` / `pet-store-pawbucks-purchase` — PawBucks Store.
- `create-invoice-payment` / `process-invoice-pawbucks-payment` — invoicing (already has `tax_rate`/`tax_amount` columns, manually entered).
- `purchase-market-service`, `create-merchant-subscription` (recurring; out of scope for phase 1).

**Data model**
- `transactions` (amount, stripe_amount, pawbucks_used, application_fee, amount_refunded), `transaction_items` (line items already captured), `direct_payments` (Stripe mirror).
- `pet_store_orders` / `pet_store_order_items`.
- Catalogs are spread across `pet_store_items`, `merchant_services`, `invoice_catalog_items`, `merchant_market_services`, plus Stripe Connect products (`list-connect-products` already unifies these for the POS picker).
- **No customer address anywhere** — `profiles` has no address fields. `merchants.address` exists; `service_bookings.service_address` exists; `invoice_clients` has full address.

**Refunds**: `admin-issue-refund`, `merchant-issue-refund` (write `amount_refunded`), analytics prorate fees/rewards by un-refunded share.

## Where tax integrates

A single shared server-side tax engine in `supabase/functions/_shared/tax.ts` used by every checkout path, called *after* line items and location are known and *before* the PaymentIntent is created. Amount charged = `merchandise − PawBucks applied + tip + tax`, computed only server-side.

## Plan

### 1. Migration (minimum new schema)
- `tax_categories` — admin-managed map: key, label, `stripe_tax_code`, `applies_to` (product/service), `active`. Seeded with pet food, treats, toys, supplies, grooming, walking, hiking, training, other/unclassified.
- Add to `pet_store_items`, `merchant_services`, `invoice_catalog_items`: `tax_category_key`, `tax_behavior` (`exclusive` default), `taxable` (nullable = defer to category), `tax_review_required` (flag when unmapped).
- `customer_tax_addresses` — user-scoped: line1, line2, city, state, postal_code, country, `kind` (billing/shipping/service), `is_default`, `validated_at`, `validation_source`. RLS: owner only.
- `tax_calculations` — audit trail: stripe_tax_calculation_id, user_id, merchant_id, transaction_id, order_id, invoice_id, payment_intent_id, taxable_amount, tax_amount, currency, address snapshot, jurisdictions jsonb, tax_collection_mode, status (`pending`/`committed`/`failed`/`reversed`), raw Stripe response subset, timestamps.
- `tax_calculation_line_items` — per line: source_type/source_id, name, amount, tax_code, taxable_amount, tax_amount, tax_rate, jurisdiction jsonb.
- `tax_reversals` — original calculation ref, refund id, reversed taxable/tax amount, mode (full/partial), stripe transaction id.
- Add `tax_amount`, `tax_calculation_id` to `transactions`, `direct_payments`, `pet_store_orders`.
- `platform_settings` keys: `tax_collection_mode` (`marketplace` | `merchant` | `platform`, default `merchant`), `tax_engine_enabled` (default false so nothing changes until switched on), `tax_block_on_failure`.
- Grants + RLS on every new table (admin/service_role for tax tables; owners read their own calculations).

### 2. Shared tax engine (`_shared/tax.ts`)
- `resolveTaxCode(item)` → Stripe tax code from the item's category; unmapped/ambiguous → `tax_review_required = true` and the item is flagged, never guessed.
- `calculateTax({ lineItems, address, mode, connectedAccountId })` → `stripe.tax.calculations.create` with per-line `tax_code` + `tax_behavior`, `customer_details.address` (full street/city/state/postal/country), `address_source`. Marketplace mode calls on the platform account; merchant mode calls with `stripeAccount` so liability follows configuration.
- Persists calculation + line items, returns totals for display. No hard-coded rates anywhere.
- `commitTax(calculationId, paymentIntentId)` on payment success → `stripe.tax.transactions.createFromCalculation`; `reverseTax()` for full/partial refunds (proportional, original record preserved).
- Failure policy: log server-side, return a generic customer-facing message, and block the taxable transaction when `tax_block_on_failure` is on; non-taxable-only carts proceed.

### 3. Checkout integration
- `create-combined-payment`: compute tax on merchandise/service lines (PawBucks applied does **not** reduce taxable amount), add tax to the charged amount, keep Success Fee on the merchandise portion only (never on tax or tips), store tax on the transaction. Existing PawBucks economics, caps, and auto-redeem untouched.
- `create-pet-store-payment` / `confirm-pet-store-payment` / `pet-store-pawbucks-purchase`: same engine; store tax on the order; tax excluded from PawBucks Store revenue.
- `create-direct-charge`, `create-invoice-payment`: same engine (invoicing switches from manual `tax_rate` to calculated tax when the engine is on).
- Frontend (`PaymentDialogWithPawBucks`, store checkout, receipts): display server-returned Subtotal / Discounts / PawBucks Applied / Sales Tax / Total. Address form + "recalculate on address change". No frontend math.

### 4. Webhooks & refunds
Extend the existing `stripe-webhook` and `connect-webhook` handlers (no new handlers): commit tax on `payment_intent.succeeded`, mark failed on failure/cancel, reverse proportionally on `charge.refunded` / `charge.dispute.*`. `admin-issue-refund` and `merchant-issue-refund` also record reversals.

### 5. Merchant UI
Product/service editors get a single **Tax category** select (no percentages). Unmapped items show an "awaiting tax review" badge. `tax_collection_mode` is admin-only, not a merchant setting.

### 6. Admin reporting
New **Tax** tab in the admin dashboard backed by a `get_tax_report` RPC: total taxable sales, tax collected, breakdown by jurisdiction / merchant / product category / date range, plus transaction-level detail (merchant, customer, date, item, taxable amount, tax, jurisdiction, Stripe calculation ID, payment status) with date filters and CSV export.

### 7. Tests
Vitest suite for the tax engine using a mocked Stripe Tax client: taxable product, non-taxable service, mixed cart, the seven West-LA locations, invalid address, address change mid-checkout, PawBucks-only / card-only / combined, partial and full refund, multi-merchant, multiple tax codes, Store purchase. Assertions verify the app sends correct line-level payloads and faithfully uses Stripe's returned amounts — never a hard-coded rate.

## Notes
- Nothing changes for live payments until `tax_engine_enabled` is switched on.
- **Manual Stripe Dashboard work required**: enable Stripe Tax, set the platform's origin address, register tax jurisdictions (CA to start), and — if marketplace mode is chosen — confirm Stripe Tax marketplace/liability settings for Connect.
- **Needs your tax professional**: marketplace facilitator status, which `tax_collection_mode` to run, and the taxability of each pet service category. The code accommodates all outcomes via configuration.
