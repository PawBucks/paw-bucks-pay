-- Allow anyone (authenticated or anon) to view active service purchases
-- This is needed so that badges, sponsored status, and ads can be displayed
CREATE POLICY "Anyone can view active service purchases"
ON public.merchant_service_purchases
FOR SELECT
USING (status = 'active');