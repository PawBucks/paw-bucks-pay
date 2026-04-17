-- Add multi-category support to merchants
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS business_categories text[] NOT NULL DEFAULT '{}';

-- Backfill: seed business_categories from business_type for existing merchants
UPDATE public.merchants
SET business_categories = ARRAY[business_type]
WHERE business_type IS NOT NULL 
  AND (business_categories IS NULL OR array_length(business_categories, 1) IS NULL);

-- GIN index for fast "contains" / overlap queries on the array
CREATE INDEX IF NOT EXISTS idx_merchants_business_categories 
ON public.merchants USING GIN (business_categories);

-- Recreate the public view to expose business_categories
DROP VIEW IF EXISTS public.merchants_public CASCADE;

CREATE VIEW public.merchants_public 
WITH (security_invoker = true)
AS
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