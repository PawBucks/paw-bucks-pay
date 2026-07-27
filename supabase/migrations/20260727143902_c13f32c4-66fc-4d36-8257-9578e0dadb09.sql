
-- merchant_pos_integrations: hide clover_access_token, clover_refresh_token, api_key_hash from client roles
REVOKE ALL ON public.merchant_pos_integrations FROM anon, authenticated;

GRANT SELECT (
  id, merchant_id, name, api_key_prefix, is_active, last_used_at,
  created_at, updated_at, clover_merchant_id, clover_token_expires_at
) ON public.merchant_pos_integrations TO authenticated;

GRANT INSERT (
  id, merchant_id, name, api_key_prefix, is_active, last_used_at,
  created_at, updated_at, clover_merchant_id, clover_token_expires_at
) ON public.merchant_pos_integrations TO authenticated;

GRANT UPDATE (
  name, is_active, updated_at, clover_merchant_id, clover_token_expires_at
) ON public.merchant_pos_integrations TO authenticated;

GRANT DELETE ON public.merchant_pos_integrations TO authenticated;
GRANT ALL ON public.merchant_pos_integrations TO service_role;

-- vet_pms_integrations: hide api_key_encrypted, webhook_secret from client roles
REVOKE ALL ON public.vet_pms_integrations FROM anon, authenticated;

GRANT SELECT (
  id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id,
  is_active, sync_direction, sync_frequency_minutes, settings, last_sync_at,
  created_at, updated_at
) ON public.vet_pms_integrations TO authenticated;

GRANT INSERT (
  id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id,
  is_active, sync_direction, sync_frequency_minutes, settings, last_sync_at,
  created_at, updated_at
) ON public.vet_pms_integrations TO authenticated;

GRANT UPDATE (
  provider, provider_name, api_endpoint, client_id, practice_id,
  is_active, sync_direction, sync_frequency_minutes, settings, last_sync_at, updated_at
) ON public.vet_pms_integrations TO authenticated;

GRANT DELETE ON public.vet_pms_integrations TO authenticated;
GRANT ALL ON public.vet_pms_integrations TO service_role;
