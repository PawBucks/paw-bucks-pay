# Brand-Funded PawBucks: Tight Pipeline

Goal: Brand-funded PawBucks (e.g., Orijen) can only be spent on **brand-tagged products at participating merchants**. Admins get clean tools to assign and audit every PB minted and burned per brand.

What already exists (reused, not rebuilt):
- `brand_campaigns` + `branded_pawbucks_ledger` (per user × campaign balance)
- `brand_campaign_merchants` (participating merchants)
- `redeem_branded_pawbucks` RPC with FIFO across campaigns
- Admin "Manual PB Grant" tab on each campaign (per-user)

## 1. Brand product tagging (the product gate)

Add a brand link to catalog items so we can compute "brand-eligible cart total":

- `pet_store_items.brand_id` → `brand_accounts.id` (nullable)
- `merchant_services.brand_id` → `brand_accounts.id` (nullable)
- `invoice_items.brand_id` → `brand_accounts.id` (nullable, denormalized for invoice lines)
- `invoice_catalog_items.brand_id` → `brand_accounts.id` (nullable)

UI to tag items with a brand:
- Merchant: brand dropdown on pet-store item editor, service editor, invoice line, and catalog item editor (only brands they're enrolled in via `brand_campaign_merchants`).
- Admin: bulk-tag tool in BrandCampaignsTab — search items and assign brand.

## 2. Redemption enforcement (merchant gate + product gate)

New SECURITY DEFINER function `compute_brand_redeemable_cents(p_user_id, p_merchant_id, p_line_items jsonb)`:
- Returns, per active campaign the user has balance in:
  - `eligible_cents` = sum of line totals where `line.brand_id = campaign.brand_id`, but only if merchant is `active` in `brand_campaign_merchants` for that campaign.
  - Cap = `min(user_branded_balance, eligible_cents_in_PB)`.

`redeem_branded_pawbucks` is updated to require a `p_line_items jsonb` argument and only spend up to the per-campaign cap returned above. Falls back to 0 if no eligible lines.

Wire `p_line_items` through every caller:
- `confirm-payment-success`, `create-combined-payment`, `confirm-pet-store-payment`, `pet-store-pawbucks-purchase`, `process-invoice-pawbucks-payment`, `clover-pos-webhook`, `stripe-webhook`, `redeem-pawbucks`.
- For `redeem-pawbucks` (offer redemption), line item = the offer's brand (offers gain `brand_id` too) at the merchant — gated identically.

Checkout UI changes:
- Cart shows a "Brand PawBucks available: 1,200 PB ($1.20) on Orijen items only" chip per active brand the user has balance in.
- PawBucks slider splits into: General PB + per-brand PB sliders, each capped to its eligible subtotal. Constraint memory (split-payment rules, success-fee on USD only) preserved.

## 3. Admin distribution controls (assign + audit)

Extend `AdminCampaignManageDialog`:

**Manual Grant tab** (kept):
- Adds a "Bulk grant" mode with three targeting options:
  1. CSV upload (email or user_id column)
  2. Segment query — users with N+ check-ins at participating merchants in last X days
  3. Users who purchased a brand-tagged product (auto-pulls candidates)
- Preview count + total PB to be issued + remaining pool guard before commit.
- New edge function `admin-bulk-grant-branded-pawbucks` (zod-validated, superadmin-only, batched server-side, idempotent per (campaign_id, user_id, batch_id)).

**New "Distribution & Redemption" tab** on the dialog:
- KPIs: Minted PB, Distributed (to users), Redeemed PB, Outstanding (issued − redeemed), Burn rate / day.
- Distribution ledger table: when, who, source (auto-rule / manual / bulk / check-in), amount, admin actor.
- Redemption ledger table: when, who, merchant, items, amount.
- Both backed by existing `branded_pawbucks_activity` table plus a join to `profiles`, `merchants`, and (for redeems) order/invoice line snapshot.

Admin Brand Campaigns dashboard tab gets a top-level "Brand Vault" widget — for each brand: total minted, outstanding liability, % redeemed at brand-tagged SKUs vs forfeit candidates.

## 4. Retroactive application

Migration plan for existing balances:
- Existing `branded_pawbucks_ledger` rows stay as-is.
- After the new redemption rules ship, any redeem attempt re-runs through the new gates → automatically restricted.
- One-time backfill: tag legacy brand-aligned products where merchant explicitly carries a single brand (best-effort using merchant ↔ brand_campaign_merchants where brand has 1 enrolled merchant only); rest tagged by merchants/admins via the new UI.
- A scheduled cron `branded-pb-eligibility-report` emails each affected user once: "Your X Orijen PawBucks are now spendable on Orijen products at participating stores."

## Technical details

Schema migrations (single migration each, with GRANTs + RLS):
1. `ALTER TABLE pet_store_items / merchant_services / invoice_items / invoice_catalog_items / partner_offers ADD COLUMN brand_id uuid REFERENCES brand_accounts(id) ON DELETE SET NULL;` + indexes.
2. `branded_pawbucks_activity` add `source text` ('auto_checkin' | 'manual_grant' | 'bulk_grant' | 'redeem'), `actor_user_id uuid`, `batch_id uuid`.
3. New RPC `compute_brand_redeemable_cents(uuid, uuid, jsonb) RETURNS jsonb`.
4. Update `redeem_branded_pawbucks` signature + body to require `p_line_items jsonb` and enforce per-campaign caps; old signature dropped (single-call audit, replace all call sites in same change).

Edge functions:
- New: `admin-bulk-grant-branded-pawbucks` (zod, superadmin JWT check, batched).
- Updated: every caller listed above passes `p_line_items` derived from the actual cart / invoice / offer.

Frontend:
- `AdminCampaignManageDialog.tsx`: add Bulk Grant subtab + Distribution & Redemption tab.
- `BrandCampaignsTab.tsx`: add "Brand Vault" header strip.
- Merchant editors: brand dropdown on product/service/catalog item/invoice line forms.
- Checkout: per-brand PB sliders; eligibility chip on cart.

Out of scope for this round:
- Programmatic SKU/UPC sync from external brand catalogs.
- Multi-brand per item (single brand per item only for v1).
- Cross-brand offer codes.
