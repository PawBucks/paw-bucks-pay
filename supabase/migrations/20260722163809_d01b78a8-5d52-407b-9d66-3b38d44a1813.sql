ALTER TABLE public.merchant_pos_integrations
  ADD COLUMN IF NOT EXISTS clover_access_token TEXT,
  ADD COLUMN IF NOT EXISTS clover_refresh_token TEXT,
  ADD COLUMN IF NOT EXISTS clover_token_expires_at TIMESTAMPTZ;

-- Revoke direct access to sensitive token columns from authenticated users;
-- only service_role (used by edge functions) should read/write them.
REVOKE SELECT (clover_access_token, clover_refresh_token, clover_token_expires_at)
  ON public.merchant_pos_integrations FROM authenticated;
REVOKE UPDATE (clover_access_token, clover_refresh_token, clover_token_expires_at)
  ON public.merchant_pos_integrations FROM authenticated;