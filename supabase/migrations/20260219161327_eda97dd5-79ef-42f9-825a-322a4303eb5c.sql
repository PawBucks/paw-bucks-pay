CREATE OR REPLACE VIEW public.merchants_public WITH (security_invoker = true) AS
SELECT id,
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
    website_url
   FROM merchants
  WHERE (approval_status = 'approved'::approval_status);