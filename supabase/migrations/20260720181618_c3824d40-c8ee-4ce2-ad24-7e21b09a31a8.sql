
-- Restrict access_token column of accountant_invitations from PostgREST reads.
REVOKE SELECT ON public.accountant_invitations FROM authenticated, anon;

GRANT SELECT (
  id, merchant_id, accountant_email, accountant_name, permissions,
  status, invited_at, accepted_at, expires_at, last_accessed_at,
  created_at, updated_at
) ON public.accountant_invitations TO authenticated;

GRANT INSERT, UPDATE, DELETE ON public.accountant_invitations TO authenticated;
GRANT ALL ON public.accountant_invitations TO service_role;
