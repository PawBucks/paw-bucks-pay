-- Drop and recreate the policy to ensure it works correctly
DROP POLICY IF EXISTS "Anyone can view active service purchases" ON public.merchant_service_purchases;

-- Create a policy that explicitly allows public read access to active purchases
CREATE POLICY "Public can view active service purchases"
ON public.merchant_service_purchases
FOR SELECT
TO anon, authenticated
USING (status = 'active');