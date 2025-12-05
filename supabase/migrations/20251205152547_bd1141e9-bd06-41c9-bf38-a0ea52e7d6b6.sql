-- Fix the view to use SECURITY INVOKER (the default, but being explicit)
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
  created_at
FROM public.merchants;

-- Grant public access to the view
GRANT SELECT ON public.merchants_public TO anon, authenticated;