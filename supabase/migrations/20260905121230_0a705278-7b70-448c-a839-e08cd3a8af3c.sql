ALTER TABLE public.merchant_pos_integrations
  ADD COLUMN IF NOT EXISTS has_clover_access_token boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_clover_refresh_token boolean NOT NULL DEFAULT false;

ALTER TABLE public.merchant_webhooks
  ADD COLUMN IF NOT EXISTS has_secret boolean NOT NULL DEFAULT false;

ALTER TABLE public.vet_pms_integrations
  ADD COLUMN IF NOT EXISTS has_api_key boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS has_webhook_secret boolean NOT NULL DEFAULT false;

UPDATE public.merchant_pos_integrations
SET has_clover_access_token = (clover_access_token IS NOT NULL),
    has_clover_refresh_token = (clover_refresh_token IS NOT NULL);

UPDATE public.merchant_webhooks
SET has_secret = (secret IS NOT NULL);

UPDATE public.vet_pms_integrations
SET has_api_key = (api_key_encrypted IS NOT NULL),
    has_webhook_secret = (webhook_secret IS NOT NULL);

CREATE OR REPLACE FUNCTION public.sync_integration_secret_presence()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_TABLE_NAME = 'merchant_pos_integrations' THEN
    NEW.has_clover_access_token := NEW.clover_access_token IS NOT NULL;
    NEW.has_clover_refresh_token := NEW.clover_refresh_token IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'merchant_webhooks' THEN
    NEW.has_secret := NEW.secret IS NOT NULL;
  ELSIF TG_TABLE_NAME = 'vet_pms_integrations' THEN
    NEW.has_api_key := NEW.api_key_encrypted IS NOT NULL;
    NEW.has_webhook_secret := NEW.webhook_secret IS NOT NULL;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.sync_integration_secret_presence() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.sync_integration_secret_presence() TO service_role;

DROP TRIGGER IF EXISTS sync_merchant_pos_secret_presence ON public.merchant_pos_integrations;
CREATE TRIGGER sync_merchant_pos_secret_presence
BEFORE INSERT OR UPDATE OF clover_access_token, clover_refresh_token
ON public.merchant_pos_integrations
FOR EACH ROW EXECUTE FUNCTION public.sync_integration_secret_presence();

DROP TRIGGER IF EXISTS sync_merchant_webhook_secret_presence ON public.merchant_webhooks;
CREATE TRIGGER sync_merchant_webhook_secret_presence
BEFORE INSERT OR UPDATE OF secret
ON public.merchant_webhooks
FOR EACH ROW EXECUTE FUNCTION public.sync_integration_secret_presence();

DROP TRIGGER IF EXISTS sync_vet_pms_secret_presence ON public.vet_pms_integrations;
CREATE TRIGGER sync_vet_pms_secret_presence
BEFORE INSERT OR UPDATE OF api_key_encrypted, webhook_secret
ON public.vet_pms_integrations
FOR EACH ROW EXECUTE FUNCTION public.sync_integration_secret_presence();

GRANT SELECT (has_clover_access_token, has_clover_refresh_token) ON public.merchant_pos_integrations TO authenticated;
GRANT SELECT (has_secret) ON public.merchant_webhooks TO authenticated;
GRANT SELECT (has_api_key, has_webhook_secret) ON public.vet_pms_integrations TO authenticated;

CREATE OR REPLACE VIEW public.merchant_pos_integrations_safe
WITH (security_invoker = on) AS
SELECT id, merchant_id, name, api_key_prefix, is_active, last_used_at, created_at, updated_at,
       clover_merchant_id, clover_token_expires_at, has_clover_access_token, has_clover_refresh_token
FROM public.merchant_pos_integrations;

CREATE OR REPLACE VIEW public.merchant_webhooks_safe
WITH (security_invoker = on) AS
SELECT id, merchant_id, name, url, events, is_active, last_triggered_at, failure_count, created_at, updated_at,
       has_secret
FROM public.merchant_webhooks;

CREATE OR REPLACE VIEW public.vet_pms_integrations_safe
WITH (security_invoker = on) AS
SELECT id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id, is_active,
       sync_direction, sync_frequency_minutes, last_sync_at, settings, created_at, updated_at,
       has_api_key, has_webhook_secret
FROM public.vet_pms_integrations;

REVOKE ALL ON public.merchant_pos_integrations_safe, public.merchant_webhooks_safe, public.vet_pms_integrations_safe FROM PUBLIC, anon;
GRANT SELECT ON public.merchant_pos_integrations_safe, public.merchant_webhooks_safe, public.vet_pms_integrations_safe TO authenticated;
GRANT SELECT ON public.merchant_pos_integrations_safe, public.merchant_webhooks_safe, public.vet_pms_integrations_safe TO service_role;