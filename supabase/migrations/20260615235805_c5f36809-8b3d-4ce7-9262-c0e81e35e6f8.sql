
DROP POLICY IF EXISTS "Authenticated users can view reviews" ON public.merchant_reviews;
CREATE POLICY "Anyone can view reviews"
ON public.merchant_reviews
FOR SELECT
TO anon, authenticated
USING (true);

GRANT SELECT ON public.merchant_reviews TO anon;
GRANT SELECT ON public.review_photos TO anon;
