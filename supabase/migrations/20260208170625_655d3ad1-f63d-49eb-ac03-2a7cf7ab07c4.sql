-- Fix reviewer_profiles view to allow public access for review display
-- The view intentionally exposes ONLY limited data (id, full_name, avatar_url) 
-- for users who have written reviews - this is public attribution data

-- Drop and recreate the view with security_invoker = off (defaults to security definer behavior)
DROP VIEW IF EXISTS public.reviewer_profiles;

-- Create the view WITHOUT security_invoker so it bypasses caller's RLS
-- This is intentional: we want to expose reviewer names publicly for attribution
CREATE VIEW public.reviewer_profiles AS
SELECT p.id, p.full_name, p.avatar_url
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.merchant_reviews mr WHERE mr.user_id = p.id
);

-- Grant SELECT to both authenticated and anonymous users
-- This allows review display on public merchant profile pages
GRANT SELECT ON public.reviewer_profiles TO authenticated;
GRANT SELECT ON public.reviewer_profiles TO anon;

-- Also update the get_reviewer_display_name function to ensure it works
CREATE OR REPLACE FUNCTION public.get_reviewer_display_name(reviewer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.full_name, 'Anonymous User')
  FROM public.profiles p
  WHERE p.id = reviewer_id
  AND EXISTS (SELECT 1 FROM public.merchant_reviews mr WHERE mr.user_id = p.id)
$$;

-- Grant execute to all roles
GRANT EXECUTE ON FUNCTION public.get_reviewer_display_name(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_reviewer_display_name(uuid) TO anon;