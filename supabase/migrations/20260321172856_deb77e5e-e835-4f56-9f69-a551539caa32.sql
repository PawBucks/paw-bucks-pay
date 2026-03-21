
-- Add is_paused column to merchants
ALTER TABLE public.merchants ADD COLUMN is_paused boolean NOT NULL DEFAULT false;
ALTER TABLE public.merchants ADD COLUMN paused_at timestamp with time zone;
ALTER TABLE public.merchants ADD COLUMN paused_by uuid;
ALTER TABLE public.merchants ADD COLUMN pause_reason text;

-- Recreate the merchants_public view to exclude paused merchants
CREATE OR REPLACE VIEW public.merchants_public
WITH (security_invoker=on) AS
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
  website_url,
  tos_url,
  privacy_policy_url,
  shipping_returns_policy_url
FROM merchants
WHERE approval_status = 'approved' AND is_paused = false;
