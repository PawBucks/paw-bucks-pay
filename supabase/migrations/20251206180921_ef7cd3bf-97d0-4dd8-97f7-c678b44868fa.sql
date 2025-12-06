-- Fix RLS policies to allow anonymous (unauthenticated) access to public data

-- Drop and recreate merchant_reviews SELECT policy to allow anonymous access
DROP POLICY IF EXISTS "Everyone can view reviews" ON public.merchant_reviews;

CREATE POLICY "Everyone can view reviews"
ON public.merchant_reviews
FOR SELECT
TO anon, authenticated
USING (true);

-- Ensure merchants_public view is accessible (it's a view, so no RLS, but underlying table might need grants)
-- Grant SELECT on the view to anon role
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;