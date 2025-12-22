
-- Drop and recreate the view with security_invoker=false (security definer behavior)
-- This allows public access to ONLY id and full_name, bypassing profiles RLS
DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles 
WITH (security_invoker = false)
AS SELECT id, full_name FROM public.profiles;

-- Grant SELECT access to all roles
GRANT SELECT ON public.reviewer_profiles TO anon;
GRANT SELECT ON public.reviewer_profiles TO authenticated;
