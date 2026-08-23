-- 1) Hard-revoke any client access to secret columns (idempotent safety net)
REVOKE ALL (clover_access_token, clover_refresh_token, api_key_hash) ON public.merchant_pos_integrations FROM anon, authenticated;
REVOKE ALL (secret) ON public.merchant_webhooks FROM anon, authenticated;
REVOKE ALL (api_key_encrypted, webhook_secret) ON public.vet_pms_integrations FROM anon, authenticated;

-- 2) Masked views for client reads. security_invoker keeps RLS ownership checks in force.
CREATE OR REPLACE VIEW public.merchant_pos_integrations_safe
WITH (security_invoker = on) AS
SELECT
  id,
  merchant_id,
  name,
  api_key_prefix,
  is_active,
  last_used_at,
  created_at,
  updated_at,
  clover_merchant_id,
  clover_token_expires_at,
  (clover_access_token IS NOT NULL) AS has_clover_access_token,
  (clover_refresh_token IS NOT NULL) AS has_clover_refresh_token
FROM public.merchant_pos_integrations;

CREATE OR REPLACE VIEW public.merchant_webhooks_safe
WITH (security_invoker = on) AS
SELECT
  id,
  merchant_id,
  name,
  url,
  events,
  is_active,
  last_triggered_at,
  failure_count,
  created_at,
  updated_at,
  (secret IS NOT NULL) AS has_secret
FROM public.merchant_webhooks;

CREATE OR REPLACE VIEW public.vet_pms_integrations_safe
WITH (security_invoker = on) AS
SELECT
  id,
  vet_id,
  provider,
  provider_name,
  api_endpoint,
  client_id,
  practice_id,
  is_active,
  sync_direction,
  sync_frequency_minutes,
  last_sync_at,
  settings,
  created_at,
  updated_at,
  (api_key_encrypted IS NOT NULL) AS has_api_key,
  (webhook_secret IS NOT NULL) AS has_webhook_secret
FROM public.vet_pms_integrations;

REVOKE ALL ON public.merchant_pos_integrations_safe FROM anon;
REVOKE ALL ON public.merchant_webhooks_safe FROM anon;
REVOKE ALL ON public.vet_pms_integrations_safe FROM anon;

GRANT SELECT ON public.merchant_pos_integrations_safe TO authenticated;
GRANT SELECT ON public.merchant_webhooks_safe TO authenticated;
GRANT SELECT ON public.vet_pms_integrations_safe TO authenticated;

GRANT SELECT ON public.merchant_pos_integrations_safe TO service_role;
GRANT SELECT ON public.merchant_webhooks_safe TO service_role;
GRANT SELECT ON public.vet_pms_integrations_safe TO service_role;