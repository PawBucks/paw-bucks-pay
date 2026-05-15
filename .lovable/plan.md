## Goal

Every total a user sees — wallet balance, sales, Success Fees, rewards, payouts, GMV — must be **provably correct** and consistent across every page. Today the same number is computed in many different places (hooks, edge functions, SQL RPCs, components), which is why values can disagree.

We will **centralize all financial totals into a single server-computed source of truth**, with these rules:

- **Stripe is source of truth for: Success Fees, Stripe processing fees, payouts, refunds.**
- **Database is source of truth for: PawBucks balances, PawBucks earned/redeemed ledger, transaction list.**
- All USD displays follow project rules: 1,000 PB = $1.00, Success Fee = 3% of Stripe-funded portion only, never on PawBucks.
- One canonical formatter for currency on the client.

## Phase 1 — Audit (read-only, produces a report)

Build a one-shot script + admin "Reconciliation Report" page that, for a given date range, compares every total a user sees to the canonical recomputed value. Output: a CSV in `/mnt/documents/` and an in-app table listing every mismatch with: surface, displayed value, canonical value, delta, root cause.

Surfaces audited:

- **Pet Owner**: wallet balance (USD), lifetime earned, lifetime redeemed, pet fund balance, transaction history sums, welcome credit, referral escrow.
- **Merchant**: Total Sales (net of refunds), PawBucks Received (USD), Success Fees Paid, Rewards Given, Total Transactions, Available Balance, Pending Balance, Tax Vault totals, Daily Reconciliation totals.
- **Vet**: earnings, payouts, financing balance, loan repayment.
- **Brand**: campaign spend, PawBucks distributed, impressions/clicks cost, ROI.
- **Admin**: GMV, total Success Fees collected, total rewards, total refunds, total users/merchants.

Deliverable: a written report we review **before** changing any displayed numbers.

## Phase 2 — Canonical totals service

Create `supabase/functions/_shared/totals/` with pure, unit-tested functions. One module per domain:

- `pawbucks.ts` — PB↔USD conversion, balance from `pawbucks_activity` ledger, expiration handling.
- `transactions.ts` — net sales, gross sales, refunded amount, PawBucks portion, Stripe portion, per-tx Success Fee.
- `stripeFees.ts` — fetches Success Fees + Stripe processing fees from Stripe charges/balance transactions, with caching keyed by `pi_*` / `ch_*`.
- `merchantTotals.ts`, `petOwnerTotals.ts`, `vetTotals.ts`, `brandTotals.ts`, `platformTotals.ts` — compose the above into the exact shape each surface needs.

These modules become the **only** place totals are computed. Every existing edge function (`merchant-dashboard`, `get-merchant-earnings`, `merchant-daily-summary`, `merchant-transactions`, `get-wallet`, `get-wallet-history`, admin analytics RPC) is refactored to call them. Frontend hooks call those functions and never recompute.

Unit tests cover: refund handling, split PB+USD payments, $0 Stripe portion (100% PawBucks → $0 fee), tipping (USD only), tier multipliers, expired PB exclusion, idempotent ledger entries.

## Phase 3 — Surface refactors (one per PR-equivalent commit)

For each surface, replace local math with calls to the canonical service and add a `<TotalsConsistencyCheck>` dev-only badge that warns in the console if a displayed total drifts from a re-fetch.

Order:
1. Merchant dashboard + analytics cards + Tax Vault + Daily Reconciliation
2. Pet Owner wallet + transaction history + pet fund
3. Admin platform analytics
4. Vet earnings + financing
5. Brand campaign analytics

## Phase 4 — Backfill + reconciliation cron

- One-time backfill: re-run `backfill-fee-expenses` style job over all historical transactions to populate `success_fee_usd` and `stripe_processing_fee_usd` columns from Stripe balance transactions.
- Nightly cron `reconcile-totals` (3am EST): recomputes per-merchant + per-user totals, writes to `analytics_snapshots`, alerts admin on any drift > $0.01.

## Phase 5 — Verification

- Run Phase 1 audit again. Required result: **zero mismatches** across all surfaces.
- Add a Vitest + Deno test suite that locks the canonical formulas; CI fails if anyone changes a fee/PB conversion without updating tests.

## Technical notes

- Schema additions (migration): `transactions.success_fee_usd numeric`, `transactions.stripe_processing_fee_usd numeric`, `transactions.stripe_balance_txn_id text`, `analytics_snapshots(merchant_id, user_id, snapshot_date, payload jsonb)`. No data is changed by the schema migration; backfill runs separately.
- Caching: Stripe balance-transaction lookups cached in a new `stripe_fee_cache` table keyed by charge id, so repeated dashboard loads do not re-hit Stripe.
- All money math in cents (integers) inside the service; convert to display USD only at the edge.
- All dates bucketed in `America/New_York` per the platform timezone rule.

## Out of scope for this plan

- No changes to checkout flow, no changes to how PawBucks are awarded, no changes to subscription billing logic. This plan only changes how we **measure and display** what already happened.

## What I need from you to start

1. Approve this plan, OR tell me to narrow it (e.g. "Merchant + Admin only first").
2. Confirm I can add the `analytics_snapshots`, `stripe_fee_cache`, and three `transactions` columns via migration.
3. Confirm the Stripe API key currently in secrets has read access to `balance_transactions` (it should, since `get-merchant-earnings` already uses it).

Once approved, I will start with **Phase 1 (audit-only)** and deliver the mismatch report before changing any displayed value.
