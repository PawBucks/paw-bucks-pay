# Deals & Promotions Flow — Align to Diagram

## Current state (audit)

**Scan → Unlock** (`CheckInPage` → `process_checkin` → `unlock-acquisition-offers` + `distribute-branded-pawbucks`)

| Merchant type | New Customer Offer | Partner Deal | Branded PawBucks |
|---|---|---|---|
| Acquisition-Only (`fee_model='acquisition_only'`) | Unlocked (first-time only) | N/A | Distributed |
| Full Ecosystem (`fee_model='full_ecosystem'`) | **Not unlocked** (function early-returns) | **Not unlocked** as a redemption | Distributed |

**My Deals page** — 3 stacked sections (Unlocked new-customer, browse full-ecosystem, branded activity history). No Active/Redeemed tab split; branded rewards shown as activity log, not as offer cards; layout diverges from mockup.

## Gaps vs. diagram

1. Full Ecosystem scan doesn't unlock New Customer Offer (for first-time customers) or Partner Deals into "My Deals".
2. My Deals lacks the Active/Redeemed tabbed layout from the mockup.
3. Offer cards don't show the diagram's three-way visual distinction (New Customer / Partner Deal / Branded PawBucks) with colored type badges.

## Changes

### 1. Backend — unlock logic (rename & extend)

Rename `unlock-acquisition-offers` → `unlock-merchant-offers` (keep old path as alias for one release).

New behavior after a valid check-in:

```text
if merchant.fee_model == 'acquisition_only':
    unlock offer_type='new_customer'  (first-time customer only, one code)
elif merchant.fee_model == 'full_ecosystem':
    if first-time customer at this merchant:
        unlock offer_type='new_customer'  (one code)
    unlock every active offer_type='partner_deal'  (one code each, respects per_user_limit / redemption_cap)
```

Branded PawBucks continues to run via `distribute-branded-pawbucks` (unchanged).

Migration: no schema change required — `partner_offers.offer_type` is already free-text. Add a lightweight CHECK narrowing values to `('new_customer','partner_deal','pawbucks_redemption')` and default `'partner_deal'`.

### 2. Frontend — CheckInPage

Replace the invoke of `unlock-acquisition-offers` with `unlock-merchant-offers`. Toast copy adapts to the offer_type(s) returned. No other changes.

### 3. Frontend — My Deals page (rebuild to match mockup)

Single unified layout:

```text
[← back]            My Deals
       [ Active (n) ]  [ Redeemed (n) ]

┌ card ─────────────────────────────┐
│ (logo)  Merchant Name             │
│         NEW CUSTOMER OFFER (blue) │
│         20% Off                   │
│         One-time use              │
│         Expires 07/31/2025        │
└───────────────────────────────────┘

┌ card ─────────────────────────────┐
│ (logo)  Merchant Name             │
│         PARTNER DEAL (amber)      │
│         15% Off                   │
│         Any Purchase              │
└───────────────────────────────────┘

┌ card ─────────────────────────────┐
│ (logo)  Brand/Merchant            │
│         BRANDED PAWBUCKS (purple) │
│         Earn 50 PB                │
│         When you spend $50+       │
└───────────────────────────────────┘
```

- **Active** tab = unredeemed `offer_redemptions` rows + active branded campaigns the user is enrolled in / has earned from.
- **Redeemed** tab = `offer_redemptions` with `redeemed_at` set.
- Card variant driven by `offer_type` (or `branded` synthetic). Tap card → detail modal with code + Copy button.
- "Still Locked Near You" (locked acquisition merchants) and the full-ecosystem browse grid move to a collapsed "Discover more deals" strip at the bottom, so the primary view matches the mockup.

### 4. Non-goals for this pass

- No redesign of merchant-side offer editor.
- Branded PawBucks distribution logic itself is untouched.
- No changes to check-in / QR scanning code paths (they already produce the merchant_id + checkin_id used to unlock).

## Files touched

- `supabase/functions/unlock-merchant-offers/index.ts` (new; supersedes `unlock-acquisition-offers`)
- `supabase/functions/unlock-acquisition-offers/index.ts` (thin alias forwarder for one release, then removed)
- `supabase/migrations/…_partner_offers_offer_type.sql` (CHECK constraint + default)
- `src/pages/CheckInPage.tsx` (swap function name, adjust toast)
- `src/pages/MyDeals.tsx` (rebuild UI to match mockup)
- Small helper: `src/components/deals/DealCard.tsx` (variant per offer_type)
