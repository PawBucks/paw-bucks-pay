
-- Remove stripe_account_id from merchants_public view
-- This view should only expose non-sensitive business information
DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public 
WITH (security_invoker = on)
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
  -- stripe_account_id removed for security - should be looked up server-side
FROM merchants
WHERE approval_status = 'approved';

-- Grant access to the view
GRANT SELECT ON public.merchants_public TO anon, authenticated;
