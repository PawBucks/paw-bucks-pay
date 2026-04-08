-- Restore public visibility of active service assignments for ad display
-- The previous fix was too restrictive - ads need to be visible to all visitors
DROP POLICY IF EXISTS "Authenticated can view active service assignments" ON public.merchant_service_purchases;

CREATE POLICY "Anyone can view active service assignments"
ON public.merchant_service_purchases FOR SELECT
TO anon, authenticated
USING (status = 'active' AND (expires_at IS NULL OR expires_at > now()));
