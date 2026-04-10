-- Step 1: Drop the anon policy on the base merchants table
-- This policy was exposing ALL columns (email, phone, stripe_account_id, checkin_qr_token) to anon users
DROP POLICY IF EXISTS "Anon can view approved merchants via view" ON public.merchants;

-- Step 2: Recreate merchants_public view with security_definer (security_invoker=off)
-- This allows anon users to query the view without needing a base-table policy
-- The view already filters to only safe public columns
CREATE OR REPLACE VIEW public.merchants_public
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
  linkedin_url,
  website_url,
  tos_url,
  privacy_policy_url,
  shipping_returns_policy_url
FROM merchants
WHERE approval_status = 'approved' AND is_paused = false;

-- Grant SELECT on the view to anon and authenticated roles
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;