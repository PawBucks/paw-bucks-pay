## Problem

Clover Marketplace is calling the webhook URL and getting **`Bad response status: Unauthorized`**. Two independent reasons in `supabase/functions/clover-pos-webhook/index.ts`:

1. **No verification-challenge handler.** When Clover saves a webhook URL in the Marketplace, it first hits it (a GET with `?verification_code=…`, and separately POSTs a payload with `{ verificationCode }`) and expects the code echoed back as plain text / JSON. The current function has no `GET` branch and no `verificationCode` short-circuit, so it falls straight into the `x-api-key` check and returns **401**.
2. **Wrong auth model for Marketplace-originated events.** Real Clover Marketplace webhooks are signed by Clover with an `X-Clover-Auth` (a.k.a. `Clover-Auth-Signature`) header derived from the app's **Signing Secret** — they do **not** carry the per-merchant `pk_live_...` POS key. Requiring `x-api-key` on every request rejects every legitimate Marketplace delivery as Unauthorized.

The per-merchant `pk_live_` API key path is still valid for direct POS pushes (Clover semi-integrated / our own POS bridge), so we keep it as a second accepted auth mode rather than replacing it.

## Plan

Edit **only** `supabase/functions/clover-pos-webhook/index.ts`. No schema changes, no other files.

1. **Handle the Marketplace verification challenge first**, before any auth check:
   - If `req.method === "GET"` and `url.searchParams.get("verification_code")` is present → return that code as `text/plain`, 200.
   - If `req.method === "POST"` and the JSON body contains a top-level `verificationCode` (and no `amount`/`tender`) → return `{ verificationCode }` as JSON, 200.
2. **Accept two auth modes** for real events:
   - **Marketplace mode:** if header `x-clover-auth` (or `clover-auth-signature`) is present, verify it against a new secret `CLOVER_APP_SIGNING_SECRET` (HMAC-SHA256 of the raw request body, compared in constant time). On mismatch → 401. On match → resolve the merchant from the Clover `merchant` id in the payload via `merchant_pos_integrations.clover_merchant_id` (already the column we hash the pk against).
   - **Direct POS mode (unchanged):** if no Clover signature header, fall back to the existing `x-api-key` (`pk_live_...`) lookup against `merchant_pos_integrations.api_key_hash`.
3. **Add the signing secret via `add_secret`** for `CLOVER_APP_SIGNING_SECRET` (user pastes the value Clover shows in the Marketplace app's "App Settings → Secret" panel). Do not hardcode.
4. **Improve error visibility** — when either auth path fails, log the reason (never the header value) so future Clover re-verifications are debuggable from edge-function logs.
5. **Keep the existing payload schema and downstream Zod validation intact** for real events. Verification requests short-circuit before Zod runs.

## Verification

- Re-save the webhook URL in the Clover Marketplace app → expect green "Verified".
- Trigger a test `PAYMENTS` event from Clover sandbox → expect 200 and a row in `pos_transactions`.
- Direct POS push with `x-api-key: pk_live_...` still returns 200 (regression check).
- Missing/incorrect `x-clover-auth` on a signed request returns 401 with a log line, not a silent accept.

## Technical notes

- `verify_jwt = false` is already set in `supabase/config.toml` for this function, so Supabase's gateway will not add its own Unauthorized layer; the 401 the user is seeing is definitively coming from inside the function.
- HMAC uses `crypto.subtle.importKey` + `sign("HMAC", …)` with SHA-256 over the raw request text (must read `await req.text()` once and `JSON.parse` from that string so signature and parsed body stay in sync).
- Constant-time compare via a length-checked XOR loop on the hex strings — avoid `===` on secrets.
