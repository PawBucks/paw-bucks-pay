-- Add stripe_account_id to merchants_public view for storefront access
-- This is not sensitive data - it's Stripe's internal account ID used for public storefronts

DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public
WITH (security_invoker = on) AS
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
    linkedin_url,
    stripe_account_id
FROM merchants
WHERE approval_status = 'approved';

COMMENT ON VIEW public.merchants_public IS 'Public view of approved merchants with non-sensitive fields. stripe_account_id included for storefront product lookups.';