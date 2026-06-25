-- Revoke direct SELECT on sensitive token/secret columns from client roles.
-- Edge functions use service_role and are unaffected.

REVOKE SELECT (secret) ON public.merchant_webhooks FROM anon, authenticated;
REVOKE SELECT (access_token) ON public.accountant_invitations FROM anon, authenticated;
REVOKE SELECT (access_token) ON public.admin_invoices FROM anon, authenticated;
REVOKE SELECT (invitation_token) ON public.brand_accounts FROM anon, authenticated;
REVOKE SELECT (access_token) ON public.pet_consent_requests FROM anon, authenticated;