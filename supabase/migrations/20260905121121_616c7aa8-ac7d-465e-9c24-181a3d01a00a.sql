REVOKE SELECT ON TABLE public.merchant_pos_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, merchant_id, api_key_prefix, name, is_active, last_used_at, created_at, updated_at, clover_merchant_id, clover_token_expires_at) ON public.merchant_pos_integrations TO authenticated;
GRANT SELECT ON public.merchant_pos_integrations_safe TO authenticated;

REVOKE SELECT ON TABLE public.merchant_webhooks FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, merchant_id, name, url, events, is_active, last_triggered_at, failure_count, created_at, updated_at) ON public.merchant_webhooks TO authenticated;
GRANT SELECT ON public.merchant_webhooks_safe TO authenticated;

REVOKE SELECT ON TABLE public.vet_pms_integrations FROM PUBLIC, anon, authenticated;
GRANT SELECT (id, vet_id, provider, provider_name, api_endpoint, client_id, practice_id, is_active, sync_direction, last_sync_at, sync_frequency_minutes, settings, created_at, updated_at) ON public.vet_pms_integrations TO authenticated;
GRANT SELECT ON public.vet_pms_integrations_safe TO authenticated;