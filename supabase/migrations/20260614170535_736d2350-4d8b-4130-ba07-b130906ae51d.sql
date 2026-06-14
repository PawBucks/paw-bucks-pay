-- Prevent merchant webhook signing secrets from being returned to the browser.
-- Revoke column-level SELECT on `secret` so PostgREST cannot return it to
-- authenticated clients, even though the row-level SELECT policy still allows
-- the merchant to read the rest of the row. Service role retains full access
-- for edge functions that need to sign outbound payloads.

REVOKE SELECT (secret) ON public.merchant_webhooks FROM authenticated;
REVOKE SELECT (secret) ON public.merchant_webhooks FROM anon;

-- Re-grant SELECT on all non-secret columns so existing merchant queries keep working.
GRANT SELECT
  (id, merchant_id, name, url, events, is_active, last_triggered_at, failure_count, created_at, updated_at)
  ON public.merchant_webhooks TO authenticated;

-- Keep write privileges scoped through RLS as before.
GRANT INSERT, UPDATE, DELETE ON public.merchant_webhooks TO authenticated;
GRANT ALL ON public.merchant_webhooks TO service_role;