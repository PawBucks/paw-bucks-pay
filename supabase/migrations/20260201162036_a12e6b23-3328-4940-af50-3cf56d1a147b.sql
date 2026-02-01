
-- =========================================================
-- SECURITY FIX PART 4b: Restore phone in merchants_public view
-- Phone is intentionally public for business contact purposes (customer support)
-- Other sensitive data like email, owner_name, stripe_account_id remain protected
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
    phone, -- Restored: business contact number is intentionally public for customers
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
'Public merchant directory - shows approved merchants with public business info. Excludes sensitive owner data (email, owner_name, stripe_account_id).';
