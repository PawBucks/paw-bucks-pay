-- Restore public visibility of approved merchants by recreating merchants_public
-- WITHOUT security_invoker, so the view enforces its own approval_status filter
-- and is readable by anon + authenticated (matching pre-multi-category behavior).
DROP VIEW IF EXISTS public.merchants_public CASCADE;

CREATE VIEW public.merchants_public AS
SELECT
  id,
  business_name,
  business_type,
  business_categories,
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
  facebook_url,
  instagram_url,
  twitter_url,
  linkedin_url,
  website_url,
  tos_url,
  privacy_policy_url,
  shipping_returns_policy_url,
  storefront_slug
FROM public.merchants
WHERE approval_status = 'approved';

GRANT SELECT ON public.merchants_public TO anon, authenticated;