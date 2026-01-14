-- Recreate the merchants_public view with security_invoker=off (security definer)
-- This is intentional - the view is designed to expose only public-safe merchant data
-- while the base table has RLS that blocks direct access
DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public
WITH (security_invoker=off) AS
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

-- Grant SELECT access to all roles
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;