-- merchant_pos_integrations: strip client access to Clover credentials + api key hash
REVOKE SELECT, UPDATE, INSERT ON public.merchant_pos_integrations FROM authenticated, anon;

GRANT SELECT (id, merchant_id, name, api_key_prefix, is_active, last_used_at, created_at, updated_at, clover_merchant_id, clover_token_expires_at)
  ON public.merchant_pos_integrations TO authenticated;
GRANT INSERT (id, merchant_id, name, api_key_prefix, is_active, created_at, updated_at, clover_merchant_id)
  ON public.merchant_pos_integrations TO authenticated;
GRANT UPDATE (name, is_active, updated_at)
  ON public.merchant_pos_integrations TO authenticated;
GRANT DELETE ON public.merchant_pos_integrations TO authenticated;
GRANT ALL ON public.merchant_pos_integrations TO service_role;

-- vet_pms_integrations: strip client access to webhook secret + encrypted api key
REVOKE SELECT, UPDATE, INSERT ON public.vet_pms_integrations FROM authenticated, anon;

GRANT SELECT (id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, last_sync_at, sync_frequency_minutes, settings, created_at, updated_at)
  ON public.vet_pms_integrations TO authenticated;
GRANT INSERT (id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, sync_frequency_minutes, settings, created_at, updated_at)
  ON public.vet_pms_integrations TO authenticated;
GRANT UPDATE (provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, sync_frequency_minutes, settings, updated_at)
  ON public.vet_pms_integrations TO authenticated;
GRANT DELETE ON public.vet_pms_integrations TO authenticated;
GRANT ALL ON public.vet_pms_integrations TO service_role;