
-- Hide sensitive credential columns from client SELECT responses.
-- Edge functions still read via service_role which bypasses these grants.

REVOKE SELECT (secret) ON public.merchant_webhooks FROM authenticated, anon;
REVOKE SELECT (api_key_encrypted) ON public.vet_lab_integrations FROM authenticated, anon;
REVOKE SELECT (api_key_encrypted) ON public.vet_pms_integrations FROM authenticated, anon;
REVOKE SELECT (webhook_secret) ON public.vet_pms_integrations FROM authenticated, anon;

-- Twilio credentials: block client reads of the auth_token column (defense-in-depth
-- on top of the existing SELECT-false policy) and prevent direct client INSERT/UPDATE.
-- Writes must go through an edge function (service_role).
REVOKE SELECT (twilio_auth_token) ON public.merchant_twilio_settings FROM authenticated, anon;
REVOKE INSERT, UPDATE ON public.merchant_twilio_settings FROM authenticated, anon;
