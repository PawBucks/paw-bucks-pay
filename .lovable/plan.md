# QR Scan Unlock Flow — Acquisition-Only New Customer Deals

Right now, on the pet-owner side, the acquisition-only merchant profile only shows a static notice telling people to scan the in-store QR code. There is no actual deal surfaced, and no gating against scanning. This plan wires the existing offer + check-in infrastructure together so the deal only activates after a verified in-store scan.

## User experience

1. Pet owner opens an acquisition-only merchant profile.
2. They see the merchant's active New Customer deal as a **locked** card with a "Scan in-store to unlock" CTA.
3. They walk in, scan the merchant's QR code (existing `/checkin?token=...` flow).
4. On successful check-in at that merchant, the deal flips to **unlocked** and a one-time redemption code is generated.
5. Code stays available in the deal card and in a new "My Unlocked Deals" surface. It's redeemed in person by the merchant via the existing `merchant-confirm-redemption` flow.
6. One unlock per user per offer. Re-scanning does nothing extra. Locks are scoped per-merchant — scanning Merchant A's QR cannot unlock Merchant B's deal.

## Surfaces to change (pet-owner side only)

- `src/pages/MerchantProfile.tsx`
  - For acquisition-only merchants: fetch active `partner_offers` for the merchant, plus the current user's existing `offer_redemptions` rows for those offers.
  - Render a new `AcquisitionOfferCard`:
    - Locked state → muted card, lock icon, "Scan the in-store QR to unlock" + the existing instructions.
    - Unlocked state → highlighted card, redemption code, "Show this to the cashier" copy, expiry if any.
  - Keep the existing notice banner but tie its instructions to these cards.
- `src/components/checkin/` — new `AcquisitionUnlockedToast` shown by `CheckInPage` when the check-in is for an acquisition-only merchant with at least one eligible offer ("New Customer deal unlocked at {merchant}").
- `src/pages/CheckInPage.tsx` — after a successful `process_checkin`, if the entity is an acquisition-only merchant, call the new unlock edge function and surface the result inline (link: "View your deal").

## Backend

New edge function `unlock-acquisition-offers` (JWT-verified):
- Input: `{ merchant_id, checkin_id }`.
- Validates:
  - Caller's JWT user owns `checkins.id = checkin_id` and `checkins.merchant_id = merchant_id`, and the row was created within the last 15 minutes (matches the existing check-in verification window).
  - `merchants.fee_model = 'acquisition_only'`.
- For each active `partner_offers` row at that merchant where the user does not already have an `offer_redemptions` row:
  - Insert `offer_redemptions { offer_id, user_id, redemption_code: <ULID-style 8-char code>, partner_confirmed: false }`.
  - Respect `per_user_limit` and `redemption_cap` (skip if cap reached) and `status='active'` + date window.
- Returns `{ unlocked: [{ offer_id, redemption_code, title }] }`.
- Idempotent: re-invocations return existing codes instead of creating new ones.

New read-side helper for the profile: existing `offer_redemptions` policies already let users read their own rows, so the profile query stays client-side (no new function needed for reads).

Migration:
- Add partial unique index on `offer_redemptions (offer_id, user_id)` to enforce one redemption per offer per user (only where the platform's "single unlock" rule applies; safe because today's flows generate one code per redeem).
- Confirm `offer_redemptions` has GRANTs and RLS that allow `authenticated` users to `SELECT` their own rows and the edge function (service role) to insert.

## Gating rules

- Locked-card UI is the only place the deal appears on acquisition-only merchant profiles. We do not list these offers in `PartnerOffers` or other discovery surfaces, so users can't bypass the scan.
- Full-ecosystem merchants are unaffected — no QR-gating on their offers.

## Out of scope

- Changing the in-store redemption confirmation flow (`merchant-confirm-redemption` already handles marking codes as redeemed).
- Notifications/email for unlocked deals.
- Expiration of unlocked codes beyond the offer's existing `end_date`.

## Confirm before I build

1. Should the unlock be tied to the **most recent** check-in (must scan again to re-view) or persistent once unlocked until the user redeems it? Plan above assumes **persistent once unlocked**.
2. One offer per acquisition-only merchant, or support multiple? Plan above supports **multiple** (all active offers for that merchant unlock at once on scan).
