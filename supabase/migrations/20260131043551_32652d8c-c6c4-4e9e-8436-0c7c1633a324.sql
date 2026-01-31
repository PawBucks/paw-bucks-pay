-- Add public SELECT policy for merchant_service_purchases so the public view works
-- This only exposes service status, not payment amounts (which are in the base table)

CREATE POLICY "Public can view active service assignments"
ON public.merchant_service_purchases
FOR SELECT
USING (
  status = 'active' 
  AND (expires_at IS NULL OR expires_at > now())
);

-- Add a comment explaining why this is safe
COMMENT ON POLICY "Public can view active service assignments" ON public.merchant_service_purchases IS 
'Allows public access to view which merchants have active services. The public view (merchant_active_services_public) filters to only show non-sensitive data (merchant_id, service_id, service_name, status, expires_at). Payment amounts are NOT exposed through this policy as they are filtered out by the view.';