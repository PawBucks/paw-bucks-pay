# Line-Item Tracking for Merchant Charges

Adds optional itemized line items to in-person / manual merchant charges (PaymentDialog flow), persists them with each transaction, and surfaces them to both customers and merchants. Invoices and Pet Store orders already store items today; this extends parity to the most common transaction source on the platform.

## 1. Data model

New table `public.transaction_items`:

- `transaction_id` → `transactions.id` (FK, cascade delete, indexed)
- `merchant_id` (indexed — fast aggregate reports)
- `source_type` enum: `catalog_item` | `pet_store_item` | `merchant_service` | `custom`
- `source_id` (uuid, nullable — null for `custom`)
- `name` (text, snapshot at sale time)
- `description` (text, nullable)
- `sku` (text, nullable)
- `quantity` (numeric, default 1)
- `unit_price` (numeric, USD)
- `total` (numeric, generated: `quantity * unit_price`)
- `image_url` (text, nullable — snapshot)
- `inventory_decremented` (boolean, default false)
- `created_at` timestamptz

RLS:
- Customer can SELECT items where the parent `transactions.user_id = auth.uid()`.
- Merchant owner can SELECT items where the parent `transactions.merchant_id` belongs to them.
- INSERT only via service role (edge functions).

Inventory: trigger on insert decrements `pet_store_items.stock_quantity` when `source_type='pet_store_item'` and stock tracking is on, marks `inventory_decremented = true`. Refund flow (existing `merchant-issue-refund`) increments it back.

## 2. Backend (edge functions)

Extend the combined-payment schema to accept an optional `items[]` array:
```
items: [{ source_type, source_id?, name, description?, sku?, quantity, unit_price, image_url? }]
```

Server validates `sum(quantity * unit_price) ≈ baseAmount` (within 1¢), then writes rows to `transaction_items` after the transaction row is created. Affected functions:

- `create-combined-payment` (PawBucks-only branch + Stripe branch metadata)
- `confirm-payment-success` (writes items after Stripe confirms)

Items are also forwarded to the existing `send-receipt-email` call so the email shows the itemized table (it already accepts `items: { name, price }[]` — we'll enrich it to include quantity).

## 3. Manual charge UI (`PaymentDialogWithPawBucks`)

New collapsible "Add items (optional)" section above the amount field:

- "Add from catalog" button → existing `CatalogItemPicker` patterns reused, sourcing from `invoice_catalog_items`, `merchant_services`, and `pet_store_items` for that merchant.
- "Add custom line" → name + qty + price inputs.
- Line list shows name × qty @ price = total, with remove button.
- When ≥1 item exists, the `amount` field auto-populates from the sum and locks (with a small "Clear items to enter amount manually" link). Amount-only entry remains fully supported when no items are added.
- Items are passed through `transactionsService.createCombinedPayment` to the edge function.

## 4. Customer view (`/activity`)

In `src/pages/Activity.tsx`, each transaction row becomes expandable (chevron). On expand we fetch `transaction_items` for that id and render a simple table: item · qty · unit price · line total. Empty state: "No itemized details available for this transaction."

## 5. Merchant view

**Transactions list** (`MerchantTransactions.tsx` + `VirtualTransactionList`): each row gets an expandable items panel with the same table.

**New Items Sold report** under `MerchantSalesReport` → add a second tab "Items Sold":
- Date range picker (default last 30 days).
- Aggregated query: name, sku, total qty sold, total revenue, # transactions.
- "Export CSV" downloads to `/mnt/documents` style direct download.

## 6. Receipt email

Update `send-receipt-email` template to render a proper line-item table (item name, qty, line total) when `items` includes qty fields. Falls back to existing single-line behavior when items array is empty.

## Technical notes

- Storage: items are append-only snapshots — never mutated when the source catalog item is later edited (so historical receipts stay accurate).
- Refunds: existing partial/full refund flow is unchanged; only the inventory restore trigger is new.
- No changes to PawBucks math, fees, or payout calculations — items are descriptive metadata layered on top of the existing `transactions.amount`.
- Subscriptions, partner offers, and storefront/services checkout are explicitly out of scope per your selection.

## Files

**New**
- `supabase/migrations/<ts>_transaction_items.sql`
- `src/components/merchant/TransactionItemsPanel.tsx`
- `src/components/merchant/ItemsSoldReport.tsx`
- `src/components/payment/ManualChargeItemsEditor.tsx`

**Edited**
- `supabase/functions/create-combined-payment/index.ts`
- `supabase/functions/confirm-payment-success/index.ts`
- `supabase/functions/send-receipt-email/index.ts` (+ template)
- `supabase/functions/merchant-issue-refund/index.ts` (restore inventory)
- `src/components/PaymentDialogWithPawBucks.tsx`
- `src/services/api/transactions.service.ts`
- `src/pages/Activity.tsx`
- `src/pages/MerchantTransactions.tsx`
- `src/components/merchant/VirtualTransactionList.tsx`
- `src/pages/MerchantSalesReport.tsx`
