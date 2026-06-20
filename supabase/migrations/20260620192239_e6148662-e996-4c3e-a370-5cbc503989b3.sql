
-- 1) Convert SECURITY DEFINER views to security_invoker so caller's RLS applies
ALTER VIEW public.merchants_public SET (security_invoker = on);
ALTER VIEW public.partner_vets_public SET (security_invoker = on);
ALTER VIEW public.merchant_active_services_public SET (security_invoker = on);
ALTER VIEW public.merchant_twilio_settings_safe SET (security_invoker = on);
ALTER VIEW public.founding_50_badges_public SET (security_invoker = on);
ALTER VIEW public.reviewer_profiles SET (security_invoker = on);

-- 2) Revoke EXECUTE on all public SECURITY DEFINER functions from anon.
--    Authenticated users and service_role keep access. If a specific function
--    must be callable by anonymous visitors, re-grant it explicitly afterwards.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname AS schema_name, p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, public', r.sig);
  END LOOP;
END $$;

-- 3) Drop the bare public bucket SELECT policies. Public buckets still serve
--    files via direct public URLs; only directory/list enumeration is removed.
DROP POLICY IF EXISTS "Public can view merchant logos" ON storage.objects;
DROP POLICY IF EXISTS "Public can view product images" ON storage.objects;
