
-- merchant_pos_integrations: revoke broad access, re-grant only non-secret columns
REVOKE ALL ON public.merchant_pos_integrations FROM anon, authenticated;
GRANT SELECT (
  id, merchant_id, api_key_prefix, name, is_active, last_used_at,
  created_at, updated_at, clover_merchant_id, clover_token_expires_at
) ON public.merchant_pos_integrations TO authenticated;
GRANT INSERT (merchant_id, name, is_active), UPDATE (name, is_active), DELETE
  ON public.merchant_pos_integrations TO authenticated;
GRANT ALL ON public.merchant_pos_integrations TO service_role;

-- vet_pms_integrations: revoke broad access, re-grant only non-secret columns
REVOKE ALL ON public.vet_pms_integrations FROM anon, authenticated;
GRANT SELECT (
  id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id,
  is_active, sync_direction, last_sync_at, sync_frequency_minutes, settings,
  created_at, updated_at
) ON public.vet_pms_integrations TO authenticated;
GRANT INSERT (
  vet_id, provider, provider_name, api_endpoint, client_id, practice_id,
  is_active, sync_direction, sync_frequency_minutes, settings
), UPDATE (
  provider, provider_name, api_endpoint, client_id, practice_id,
  is_active, sync_direction, sync_frequency_minutes, settings
), DELETE
  ON public.vet_pms_integrations TO authenticated;
GRANT ALL ON public.vet_pms_integrations TO service_role;
