-- merchant_pos_integrations: no table-wide SELECT/UPDATE; grant only non-secret columns
REVOKE SELECT, UPDATE, INSERT ON public.merchant_pos_integrations FROM authenticated, anon;
GRANT SELECT (id, merchant_id, api_key_prefix, name, is_active, last_used_at, created_at, updated_at, clover_merchant_id, clover_token_expires_at) ON public.merchant_pos_integrations TO authenticated;
GRANT UPDATE (name, is_active, clover_merchant_id) ON public.merchant_pos_integrations TO authenticated;
GRANT INSERT (merchant_id, name, is_active, api_key_hash, api_key_prefix, clover_merchant_id) ON public.merchant_pos_integrations TO authenticated;
GRANT ALL ON public.merchant_pos_integrations TO service_role;

-- merchant_webhooks: exclude `secret` from client read/write
REVOKE SELECT, UPDATE, INSERT ON public.merchant_webhooks FROM authenticated, anon;
GRANT SELECT (id, merchant_id, name, url, events, is_active, last_triggered_at, failure_count, created_at, updated_at) ON public.merchant_webhooks TO authenticated;
GRANT UPDATE (name, url, events, is_active) ON public.merchant_webhooks TO authenticated;
GRANT INSERT (merchant_id, name, url, events, is_active) ON public.merchant_webhooks TO authenticated;
GRANT ALL ON public.merchant_webhooks TO service_role;

-- vet_pms_integrations: exclude api_key_encrypted and webhook_secret from client read/write
REVOKE SELECT, UPDATE, INSERT ON public.vet_pms_integrations FROM authenticated, anon;
GRANT SELECT (id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, last_sync_at, sync_frequency_minutes, settings, created_at, updated_at) ON public.vet_pms_integrations TO authenticated;
GRANT UPDATE (provider, provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, sync_frequency_minutes, settings) ON public.vet_pms_integrations TO authenticated;
GRANT INSERT (vet_id, provider, provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, sync_frequency_minutes, settings) ON public.vet_pms_integrations TO authenticated;
GRANT ALL ON public.vet_pms_integrations TO service_role;