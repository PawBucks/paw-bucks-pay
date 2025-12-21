-- First, drop the overly permissive public policy
DROP POLICY IF EXISTS "Public can view active service purchases" ON merchant_service_purchases;

-- Create a public view that only exposes what's needed for marketplace features
-- This hides payment amounts while still allowing badge/service detection
CREATE OR REPLACE VIEW public.merchant_active_services_public AS
SELECT 
    msp.merchant_id,
    msp.service_id,
    mms.name as service_name,
    msp.status,
    msp.expires_at
FROM merchant_service_purchases msp
JOIN merchant_market_services mms ON mms.id = msp.service_id
WHERE msp.status = 'active'
  AND (msp.expires_at IS NULL OR msp.expires_at > now());

-- Grant public read access to the view
GRANT SELECT ON public.merchant_active_services_public TO anon, authenticated;

-- Add a comment explaining the view's purpose
COMMENT ON VIEW public.merchant_active_services_public IS 
'Public view of active merchant services for marketplace badges/features. Hides payment amounts for security.';