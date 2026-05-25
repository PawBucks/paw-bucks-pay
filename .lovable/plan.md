## Goal

Remove broad authenticated SELECT access to the `merchants` table so internal fields (`stripe_account_id`, `fee_model`, `acquisition_fee_rate`, `funding_status`, `denial_reason`, `pause_reason`, `checkin_qr_token`, `last_notified_status`, etc.) are no longer readable by any logged-in user. Only the merchant owner and admins/superadmins keep full-row access.

## Already done in this session

- `merchants_public` view exists with safe columns and is already used in some places.
- Storage policy gaps for `vet-imaging` and `vet-invoices` are fixed.

## Plan

### 1. Extend `merchants_public` view

Add these columns the app currently reads cross-merchant from the base table:
`user_id, contact_person, owner_name, email, search_keywords, service_area_radius_miles, country, state_of_incorporation, timezone, working_style, entity_type, accepts_welcome_credit, welcome_credit_opted_in_at, is_paused, approval_status, stripe_account_status, onboarding_complete`.

Excluded (kept owner/admin-only): `stripe_account_id, fee_model, acquisition_fee_rate, funding_status, denial_reason, pause_reason, paused_at, paused_by, approved_at, approved_by, checkin_qr_token, last_notified_status, submission_email_sent_at`.

### 2. Add SECURITY DEFINER RPCs for the two flows that need `stripe_account_id` cross-merchant

- `public.get_merchant_checkout_context(p_merchant_id uuid)` — returns `{ stripe_account_id, business_name, onboarding_complete, accepts_pawbucks, cashback_rate }`. Used by `DirectCheckout.tsx` and `BookingWidget.tsx`. Only returns data for approved, non-paused merchants.

### 3. Refactor cross-merchant frontend reads

Files reading `merchants` for a merchant they don't own → switch to `merchants_public` or the RPC:

- `src/pages/DirectCheckout.tsx` → RPC for stripe_account_id; `merchants_public` for display fields.
- `src/components/scheduling/BookingWidget.tsx` → RPC for stripe_account_id.
- `src/pages/PublicBookingPage.tsx` → `merchants_public`.
- `src/pages/MerchantProfile.tsx` → `merchants_public`.
- `src/components/ReceiptUploadDialog.tsx` → `merchants_public`.
- `src/components/receipts/PartnerReceiptDialog.tsx` → `merchants_public`.
- `src/components/FeaturedMerchants.tsx`, `MerchantCard.tsx`, `FeedbackButton.tsx`, `PremiumMerchantsBanner.tsx`, discovery components → `merchants_public`.
- `src/components/scheduling/SmartScheduleTab.tsx` cross-merchant lat/lng → `merchants_public`.
- `src/services/api/platformPromotions.service.ts` cross-merchant search → `merchants_public`.
- Any other call site that reads a merchant by id/slug/keyword for a non-owner context.

Owner-scoped reads (`.eq("user_id", user.id)`) and admin tabs remain on `merchants` — their existing RLS policies cover them.

### 4. Drop the broad policy

Drop `"Authenticated users can view approved merchants"` on `public.merchants`. Keep:
- `Merchants can view their own full record` (owner)
- `Admins can view all merchants` (admin/superadmin)
- INSERT/UPDATE policies unchanged

### 5. Verify

- Run linter and security scan, confirm `merchants_stripe_fee_model_exposed` is resolved.
- Smoke-test: owner can still load their workspace; pet owner can still load a merchant profile page, checkout, and booking widget; admin can still see everything.

## Technical notes

- The view uses `security_invoker=false` (definer mode) so it bypasses base-table RLS. This is intentional and is what lets us drop the broad policy. The Supabase linter currently flags this pattern as a warning for views; the warning is accepted here because the view exposes only safe columns and only approved merchants — the access control is enforced in the view definition itself.
- RPC is `SECURITY DEFINER` with `SET search_path = public` and `REVOKE ALL FROM public; GRANT EXECUTE TO authenticated`. It validates that the merchant is approved and not paused before returning the Stripe account id.
- TypeScript types (`src/integrations/supabase/types.ts`) regenerate automatically; cross-merchant call sites switching to `merchants_public` will need a manual cast or just `(supabase.from as any)` only where typings lag.

## Out of scope

- Column-level grants on `merchants` (the user already rejected this path).
- Refactoring owner/admin merchant reads (they stay on the base table).
