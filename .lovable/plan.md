## Goal

Guarantee a frictionless Pet Owner payment experience across all four surfaces, with PawBucks **always** earned on the USD portion of every successful charge — no shape mismatches, no race conditions, no silent failures.

## Scope (confirmed)

1. In-person Pay flow — `PaymentDialog` → `create-payment-intent` / `create-combined-payment` → `confirm-payment-success`
2. Booking deposits & no-show capture — `DepositCardForm` → `create-booking-setup-intent` → `charge-no-show-fee`
3. Invoice payments — public + admin invoices, `create-invoice-payment`, `create-admin-invoice-payment`, `verify-invoice-payment`, `process-invoice-pawbucks-payment`, `RecordPaymentDialog`
4. Merchant Storefront / Pet Store cart — `create-pet-store-payment`, `confirm-pet-store-payment`, `pet-store-pawbucks-purchase`, `StorefrontCartDrawer`

Total surface: ~4,300+ LOC of edge functions plus the React payment UIs.

## Reality check

A single-pass "fix everything" across this much payment code is high risk — these flows touch money, Stripe Connect Direct Charges, the wallet, the pet fund, legacy welcome credit, idempotency, and webhooks. I'm proposing a **phased** sweep so each phase can be reviewed and shipped independently before moving on. Each phase ends with a verification step.

## Phase 0 — Audit (no code changes)

Read every file in scope and produce an inline issue list grouped by:

- **Friction** — extra clicks, confusing copy, missing loading/disabled states, retry traps, double-submit risk
- **Correctness** — PB earn missing/duplicated, success-fee math, tip handling (USD-only), min $0.50, USD/PB split rounding
- **Reliability** — idempotency keys, race conditions between `confirm` and webhooks, error swallowing, missing CORS, partial-failure rollback
- **Consistency** — query-cache shape mismatches (the bug pattern we just hit with `avg_rating`), formatter usage, EST/PST timezone, terminology ("Success Fee")
- **Security** — JWT verification, Zod validation, service-role boundaries

Deliverable: a structured report posted in chat. No files touched.

## Phase 1 — PawBucks earn guarantee (highest priority)

For each of the 4 surfaces, verify in the confirm/verify edge function that:

- Successful USD charge → `pawbucks_activity` row with `type='earn'` is written exactly once
- Earn rate respects user tier (10/20/30 PB per $1 via `useUserEarnRate` server equivalent)
- Earn is computed on **USD portion only** (never on PB-funded portion, never on tip-only? — confirm policy)
- Earn write is idempotent (keyed off `payment_intent_id` / `transaction_id`)
- Earn happens even when the user closes the tab before `confirm-*` returns (webhook fallback)

Fix any surface where earn is conditional, missing, or duplicated. Add the missing webhook-side earn write where the client-side confirm is the only path today.

## Phase 2 — Frictionless UX pass

Per surface, normalize:

- Single source of truth for "amount due" / "split" / "tip" / "fee" (no drift between client and server)
- Disable submit during in-flight Stripe calls; show spinner; prevent double-tap
- Friendly, actionable error messages (map Stripe decline codes to plain English)
- Auto-retry transient network errors once, then surface a clear retry button
- Success screen shows: USD charged, PB redeemed, PB earned, new balance — consistently across all 4 surfaces
- Respect the `max-w-4xl` / Premium Consumer aesthetic and Pet-Owner emoji policy

## Phase 3 — Reliability hardening

- Idempotency keys on every Stripe create call (payment intent, refund, setup intent)
- Wrap multi-step DB writes in a single RPC or careful try/catch with compensating actions
- Confirm webhook (`connect-webhook`) handles `payment_intent.succeeded` for **all 4** surfaces and is the authoritative earn writer; client confirms become best-effort UX accelerators
- Add structured logging tags (`[surface=pay|booking|invoice|store]`) for traceability

## Phase 4 — Verification

- Re-read each touched file
- `bun run test` for any covered paths (totals-invariants etc.)
- Manual trace of one synthetic transaction per surface in the report (PB-only, USD-only, split, tip)
- Edge function logs spot-check

## Technical details

Key files I'll touch (non-exhaustive, finalized after Phase 0):

```text
src/components/PaymentDialog.tsx
src/components/scheduling/DepositCardForm.tsx
src/components/invoicing/RecordPaymentDialog.tsx
src/components/storefront/StorefrontCartDrawer.tsx
src/hooks/useShoppingCart.ts, useStorefrontCart.ts
src/hooks/useSpendablePawBucks.tsx, useUserEarnRate.tsx

supabase/functions/create-payment-intent
supabase/functions/create-combined-payment
supabase/functions/confirm-payment-success
supabase/functions/create-booking-setup-intent
supabase/functions/charge-no-show-fee
supabase/functions/create-invoice-payment
supabase/functions/verify-invoice-payment
supabase/functions/process-invoice-pawbucks-payment
supabase/functions/create-admin-invoice-payment
supabase/functions/create-pet-store-payment
supabase/functions/confirm-pet-store-payment
supabase/functions/pet-store-pawbucks-purchase
supabase/functions/connect-webhook
supabase/functions/_shared/pet-fund-debit.ts
```

Invariants enforced everywhere:

- Min charge $0.50 USD (DB constraint already)
- Success Fee = 3% on USD portion only; label "Success Fee"
- Tipping = USD only
- PB earn on USD portion only, at user tier multiplier
- `pawbucks_activity.type ∈ {'earn','redeem'}`
- All dates rendered in America/New_York
- Spend order: wallet → pet fund → legacy welcome credit (via `_shared/pet-fund-debit.ts`)

## How we proceed

I'll execute **Phase 0 first** and post the issue report in chat. You then tell me which fixes to ship and in what order — that way you keep control over what changes in the payment money path, and we avoid a 30-file diff landing all at once.