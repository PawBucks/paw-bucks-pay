DROP FUNCTION IF EXISTS public.normalize_earned_pawbucks_expiration();

REVOKE ALL ON FUNCTION public.set_pawbucks_expiration() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_pawbucks_expiration() FROM anon;
REVOKE ALL ON FUNCTION public.set_pawbucks_expiration() FROM authenticated;
GRANT EXECUTE ON FUNCTION public.set_pawbucks_expiration() TO service_role;