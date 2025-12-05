-- Add stripe_account_id to public view (needed for storefront links)
-- This is a Stripe Connect account ID which is used in public URLs anyway
DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public 
WITH (security_invoker = true)
AS
SELECT 
  id,
  business_name,
  business_type,
  description,
  logo_url,
  address,
  latitude,
  longitude,
  cashback_rate,
  accepts_pawbucks,
  price_range,
  is_sponsored,
  sponsored_until,
  stripe_account_id,
  created_at
FROM public.merchants;

-- Grant public access to the view
GRANT SELECT ON public.merchants_public TO anon, authenticated;