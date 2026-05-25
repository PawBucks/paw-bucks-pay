-- Hide additional sensitive merchant operational columns from client roles.
-- Postgres column privileges are checked before RLS, so revoking SELECT on
-- these columns hides them from anon/authenticated queries while leaving
-- service-role (edge functions) access intact. Owners/admins that need to
-- read these values should do so via security-definer RPCs.
REVOKE SELECT (stripe_account_id, denial_reason, pause_reason, acquisition_fee_rate)
  ON public.merchants FROM authenticated;
REVOKE SELECT (stripe_account_id, denial_reason, pause_reason, acquisition_fee_rate)
  ON public.merchants FROM anon;
REVOKE SELECT (stripe_account_id, denial_reason, pause_reason, acquisition_fee_rate)
  ON public.merchants FROM PUBLIC;