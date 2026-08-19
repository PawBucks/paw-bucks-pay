REVOKE UPDATE (secret) ON public.merchant_webhooks FROM authenticated;
REVOKE UPDATE (secret) ON public.merchant_webhooks FROM anon;
GRANT ALL ON public.merchant_webhooks TO service_role;
GRANT ALL ON public.merchant_pos_integrations TO service_role;
GRANT ALL ON public.vet_pms_integrations TO service_role;