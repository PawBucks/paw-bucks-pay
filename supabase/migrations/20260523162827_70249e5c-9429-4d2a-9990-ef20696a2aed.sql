-- Remove overly-permissive public SELECT on the base table
DROP POLICY IF EXISTS "Anyone can view active service assignments" ON public.merchant_service_purchases;

-- Recreate the public marketplace view as security definer (default) so it can
-- still read non-sensitive columns without granting public RLS on the base table.
DROP VIEW IF EXISTS public.merchant_active_services_public;
CREATE VIEW public.merchant_active_services_public AS
SELECT
    msp.merchant_id,
    msp.service_id,
    mms.name AS service_name,
    msp.status,
    msp.expires_at
FROM public.merchant_service_purchases msp
JOIN public.merchant_market_services mms ON mms.id = msp.service_id
WHERE msp.status = 'active'
  AND (msp.expires_at IS NULL OR msp.expires_at > now());

GRANT SELECT ON public.merchant_active_services_public TO anon, authenticated;

COMMENT ON VIEW public.merchant_active_services_public IS
'Public marketplace view of active merchant services. Runs as definer so it can expose only non-sensitive columns (merchant_id, service_id, service_name, status, expires_at) while the underlying merchant_service_purchases table keeps payment amounts and Stripe IDs private.';