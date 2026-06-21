-- Defense-in-depth: revoke all direct client access to phone_verifications.
-- Edge functions use the service role; no client should ever touch this table directly.
REVOKE ALL ON public.phone_verifications FROM anon, authenticated;
GRANT ALL ON public.phone_verifications TO service_role;