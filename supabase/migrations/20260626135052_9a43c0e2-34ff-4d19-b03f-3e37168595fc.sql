
-- admin_invoices.access_token
REVOKE SELECT (access_token) ON public.admin_invoices FROM anon, authenticated;

-- brand_accounts.invitation_token
REVOKE SELECT (invitation_token) ON public.brand_accounts FROM anon, authenticated;

-- invoices.access_token
REVOKE SELECT (access_token) ON public.invoices FROM anon, authenticated;

-- merchant_webhooks.secret
REVOKE SELECT (secret) ON public.merchant_webhooks FROM anon, authenticated;

-- pet_consent_requests.access_token
REVOKE SELECT (access_token) ON public.pet_consent_requests FROM anon, authenticated;

-- vet_lab_integrations.api_key_encrypted
REVOKE SELECT (api_key_encrypted) ON public.vet_lab_integrations FROM anon, authenticated;

-- vet_pms_integrations.api_key_encrypted, webhook_secret
REVOKE SELECT (api_key_encrypted, webhook_secret) ON public.vet_pms_integrations FROM anon, authenticated;
