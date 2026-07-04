-- Hide sensitive bearer tokens and webhook signing secrets from PostgREST clients.
-- Column-level REVOKEs prevent authenticated/anon roles from selecting the token
-- columns, while leaving all other columns readable per existing RLS policies.
-- The service_role (used by edge functions) is unaffected and can still read the
-- values it needs server-side.

REVOKE SELECT (access_token) ON public.accountant_invitations FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.admin_invoices FROM authenticated, anon;
REVOKE SELECT (invitation_token) ON public.brand_accounts FROM authenticated, anon;
REVOKE SELECT (secret) ON public.merchant_webhooks FROM authenticated, anon;
REVOKE SELECT (access_token) ON public.pet_consent_requests FROM authenticated, anon;