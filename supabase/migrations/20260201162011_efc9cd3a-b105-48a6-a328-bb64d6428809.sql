
-- =========================================================
-- SECURITY FIX PART 4: Fix merchants_public view - remove phone
-- =========================================================

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
FROM merchants
WHERE approval_status = 'approved';

COMMENT ON VIEW public.merchants_public IS 
'Public merchant directory - shows only approved merchants. Phone removed for privacy protection.';
