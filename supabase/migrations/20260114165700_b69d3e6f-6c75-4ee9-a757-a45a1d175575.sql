-- Drop and recreate the merchants_public view to include social media columns
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
  phone,
  cashback_rate,
  accepts_pawbucks,
  storefront_slug,
  price_range,
  is_sponsored,
  sponsored_until,
  latitude,
  longitude,
  facebook_url,
  instagram_url,
  twitter_url,
  linkedin_url
FROM public.merchants;

-- Grant access
GRANT SELECT ON public.merchants_public TO anon, authenticated;