
-- Grant SELECT access on reviewer_profiles view to anon and authenticated roles
GRANT SELECT ON public.reviewer_profiles TO anon;
GRANT SELECT ON public.reviewer_profiles TO authenticated;
