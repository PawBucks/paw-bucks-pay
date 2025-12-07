-- Recreate merchants_public view to include phone number for customer contact
DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public AS
SELECT 
  id,
  business_name,
  business_type,
  description,
  logo_url,
  address,
  phone,
  latitude,
  longitude,
  cashback_rate,
  accepts_pawbucks,
  price_range,
  is_sponsored,
  sponsored_until,
  created_at
FROM public.merchants;

-- Grant SELECT access to anon and authenticated roles
GRANT SELECT ON public.merchants_public TO anon, authenticated;