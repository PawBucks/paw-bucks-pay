-- Create a secure view that exposes only public profile information needed for reviews
CREATE OR REPLACE VIEW public.reviewer_profiles AS
SELECT 
  id,
  full_name
FROM public.profiles;

-- Allow everyone to read from this view for displaying reviewer names
GRANT SELECT ON public.reviewer_profiles TO anon, authenticated;