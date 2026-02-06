-- ROLLBACK the overly permissive policy
DROP POLICY IF EXISTS "Public can view reviewer basic info" ON public.profiles;

-- Better approach: For reviewer_profiles view, we need a secure function pattern
-- Create a security definer function to get reviewer info without exposing all profile columns

CREATE OR REPLACE FUNCTION public.get_reviewer_profile(reviewer_id uuid)
RETURNS TABLE(id uuid, full_name text, avatar_url text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.avatar_url
  FROM profiles p
  WHERE p.id = reviewer_id
  AND EXISTS (SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = p.id)
$$;

COMMENT ON FUNCTION public.get_reviewer_profile IS 'Securely fetch reviewer public info without exposing full profile';

-- Drop the view that now would fail due to security_invoker
DROP VIEW IF EXISTS public.reviewer_profiles;

-- Recreate reviewer_profiles as a function-backed approach
-- Since views with security_invoker need RLS to work, and we don't want to expose profiles,
-- We'll create a simple view that the reviews query will join
CREATE VIEW public.reviewer_profiles AS
SELECT 
    p.id,
    p.full_name,
    p.avatar_url
FROM profiles p
WHERE EXISTS (SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = p.id);

-- Grant access to the view
GRANT SELECT ON public.reviewer_profiles TO anon, authenticated;

COMMENT ON VIEW public.reviewer_profiles IS 'Public reviewer names for review attribution - only exposes name and avatar';