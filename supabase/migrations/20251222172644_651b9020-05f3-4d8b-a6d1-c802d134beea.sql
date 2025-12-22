-- Fix the view to use SECURITY INVOKER (default, non-security-definer)
DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles 
WITH (security_invoker = true) AS
SELECT 
  id,
  full_name
FROM public.profiles;

-- Allow everyone to read from this view for displaying reviewer names
GRANT SELECT ON public.reviewer_profiles TO anon, authenticated;