# Clover Receipt Note Write-Back

Every time our `clover-pos-webhook` processes a transaction that earns or redeems PawBucks, call Clover's REST API to attach the note **"Paid via PawBucks - Balance Updated."** to both the order and the payment so it prints on the customer receipt.

## Current state (verified)

- `supabase/functions/clover-pos-webhook/index.ts` is inbound only — Clover pushes events to us, we never call Clover back.
- `merchant_pos_integrations` stores `clover_merchant_id` and a hashed inbound API key, but **no OAuth access token column** exists yet. You said Clover OAuth is set up on the Marketplace side; we still need a place to persist the per‑merchant token our webhook can read.

## What we'll build

### 1. Storage for Clover OAuth tokens
Add three columns to `merchant_pos_integrations`:
- `clover_access_token` (text, encrypted-at-rest via existing pattern)
- `clover_refresh_token` (text, nullable — Clover v2 OAuth)
- `clover_token_expires_at` (timestamptz, nullable)

RLS stays merchant-scoped; only `service_role` reads the token columns.

### 2. OAuth callback edge function
New function `clover-oauth-callback` that:
- Accepts Clover's OAuth redirect (`code`, `merchant_id`).
- Exchanges the code at `https://api.clover.com/oauth/v2/token` using `CLOVER_APP_ID` + `CLOVER_APP_SECRET` (secrets to add).
- Upserts the tokens into `merchant_pos_integrations` keyed on `clover_merchant_id`.

### 3. Shared Clover REST helper
New `supabase/functions/_shared/clover.ts` with:
- `getMerchantToken(clover_merchant_id)` — pulls & refreshes if expired.
- `addOrderNote(mId, orderId, note)` — `POST /v3/merchants/{mId}/orders/{orderId}` with `{ note }` (Clover merges into existing note; we prepend to preserve anything already there).
- `addPaymentNote(mId, orderId, paymentId, note)` — `POST /v3/merchants/{mId}/orders/{orderId}/payments/{paymentId}` with `{ note }`.
- Clover receipt templates print order notes and payment notes by default; no extra "print flag" API exists — the note field itself is what prints. We'll document that in the code comment.

### 4. Wire it into `clover-pos-webhook`
After the existing PawBucks earn/redeem write completes successfully and `orderId` (and `paymentId` when present) are on the payload:
- Call `addOrderNote` and `addPaymentNote` with `"Paid via PawBucks - Balance Updated."`.
- Wrap in try/catch — a Clover write failure must NOT roll back the ledger update; log to `webhook_delivery_logs` with `status='clover_note_failed'` so ops can retry.
- Trigger fires on **both earn and redeem** (i.e., any successful PawBucks-tagged tender we process), per your answer.

### 5. Secrets required
- `CLOVER_APP_ID`
- `CLOVER_APP_SECRET`

I'll request these via the secrets flow once the plan is approved.

## Out of scope
- Backfilling notes on historical Clover transactions.
- Editing Clover receipt template layout (Clover controls that; the note field is what surfaces on the printed/emailed receipt).

## Files touched
- `supabase/migrations/<new>.sql` — add token columns
- `supabase/functions/_shared/clover.ts` — new
- `supabase/functions/clover-oauth-callback/index.ts` — new
- `supabase/functions/clover-pos-webhook/index.ts` — call note helpers after ledger write
- `supabase/config.toml` — register new function with `verify_jwt = false`
