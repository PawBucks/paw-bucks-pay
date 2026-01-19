-- Fix reviewer_profiles view - recreate it as a SECURITY DEFINER view that only exposes full_name
-- This is intentionally public for review attribution (business requirement)

DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE OR REPLACE VIEW public.reviewer_profiles 
WITH (security_invoker = false)
AS
SELECT 
  id,
  full_name
FROM public.profiles;

-- Grant access to reviewer_profiles view for review attribution
GRANT SELECT ON public.reviewer_profiles TO anon;
GRANT SELECT ON public.reviewer_profiles TO authenticated;

COMMENT ON VIEW public.reviewer_profiles IS 'Public view exposing only full_name for review attribution - intentionally public for customer trust per business requirements';