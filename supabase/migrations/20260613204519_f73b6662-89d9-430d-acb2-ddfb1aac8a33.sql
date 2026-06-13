
-- Restrict client read access to webhook/integration secret columns via column-level REVOKE.
-- After this, table-level SELECT remains but secret columns are not readable; SELECT * will fail
-- unless callers enumerate columns. Service role retains full access.

REVOKE SELECT (secret) ON public.merchant_webhooks FROM authenticated, anon;
REVOKE SELECT (webhook_secret, api_key_encrypted) ON public.vet_pms_integrations FROM authenticated, anon;
REVOKE SELECT (api_key_encrypted) ON public.vet_lab_integrations FROM authenticated, anon;
