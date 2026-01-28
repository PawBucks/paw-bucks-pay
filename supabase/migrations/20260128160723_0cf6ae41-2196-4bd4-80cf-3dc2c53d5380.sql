
-- Fix: Recreate views with security_invoker = on to respect profiles table RLS

-- Drop and recreate merchant_customer_contacts view with security_invoker
DROP VIEW IF EXISTS public.merchant_customer_contacts;
CREATE VIEW public.merchant_customer_contacts
WITH (security_invoker = on)
AS SELECT 
  id,
  full_name,
  email,
  phone,
  stripe_customer_id
FROM public.profiles;

-- Grant select to authenticated users (RLS on profiles table will control access)
GRANT SELECT ON public.merchant_customer_contacts TO authenticated;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.merchant_customer_contacts IS 'View for merchants to access customer contact info - respects profiles RLS policies';

-- Drop and recreate reviewer_profiles view with security_invoker
DROP VIEW IF EXISTS public.reviewer_profiles;
CREATE VIEW public.reviewer_profiles
WITH (security_invoker = on)
AS SELECT 
  id,
  full_name
FROM public.profiles;

-- Grant select to authenticated users (RLS on profiles table will control access)
GRANT SELECT ON public.reviewer_profiles TO authenticated;

-- Also grant to anon for public review display
GRANT SELECT ON public.reviewer_profiles TO anon;

-- Add comment explaining the view's purpose
COMMENT ON VIEW public.reviewer_profiles IS 'View for displaying reviewer names on public reviews - respects profiles RLS policies';

-- Add a policy to profiles table allowing public SELECT of minimal fields for review attribution
-- This allows anonymous users to see reviewer names on public reviews
CREATE POLICY "Anyone can view reviewer names for public reviews"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_reviews mr
      WHERE mr.user_id = profiles.id
    )
  );
