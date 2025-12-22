-- Fix Issue 1: Profile PII Exposure
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Anyone can view profile names for reviews" ON public.profiles;

-- The reviewer_profiles view already exists, let's grant access to it for reviews
-- Grant SELECT on the reviewer_profiles view to anon and authenticated roles
GRANT SELECT ON public.reviewer_profiles TO anon, authenticated;

-- Fix Issue 2: Analytics Data Poisoning
-- Drop the overly permissive INSERT policies
DROP POLICY IF EXISTS "Allow inserting search ranking analytics" ON public.search_ranking_analytics;
DROP POLICY IF EXISTS "Allow inserting sponsored analytics" ON public.sponsored_placement_analytics;

-- Create restricted policies that only allow service_role to insert
CREATE POLICY "Service role can insert search ranking analytics"
  ON public.search_ranking_analytics FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Service role can insert sponsored analytics"
  ON public.sponsored_placement_analytics FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');