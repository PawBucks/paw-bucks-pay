
-- 1. Replace merchants_public view with an expanded set of safe columns
DROP VIEW IF EXISTS public.merchants_public CASCADE;

CREATE VIEW public.merchants_public AS
SELECT
  id,
  user_id,
  business_name,
  business_type,
  business_categories,
  description,
  logo_url,
  address,
  phone,
  email,
  contact_person,
  owner_name,
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
  storefront_slug,
  pawbucks_cap_enabled,
  pawbucks_cap_pct,
  pawbucks_promo_cap_pct,
  pawbucks_promo_starts_at,
  pawbucks_promo_ends_at,
  search_keywords,
  service_area_radius_miles,
  country,
  state_of_incorporation,
  timezone,
  working_style,
  entity_type,
  accepts_welcome_credit,
  welcome_credit_opted_in_at,
  is_paused,
  approval_status,
  stripe_account_status,
  onboarding_complete,
  created_at,
  updated_at
FROM public.merchants
WHERE approval_status = 'approved';

GRANT SELECT ON public.merchants_public TO anon, authenticated;

-- 2. SECURITY DEFINER helper for checkout/booking flows that legitimately need stripe_account_id
CREATE OR REPLACE FUNCTION public.get_merchant_checkout_context(p_merchant_id uuid)
RETURNS TABLE (
  id uuid,
  business_name text,
  stripe_account_id text,
  stripe_account_status text,
  onboarding_complete boolean,
  accepts_pawbucks boolean,
  cashback_rate numeric,
  timezone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    m.id,
    m.business_name,
    m.stripe_account_id,
    m.stripe_account_status,
    m.onboarding_complete,
    m.accepts_pawbucks,
    m.cashback_rate,
    m.timezone
  FROM public.merchants m
  WHERE m.id = p_merchant_id
    AND m.approval_status = 'approved'
    AND COALESCE(m.is_paused, false) = false
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.get_merchant_checkout_context(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_merchant_checkout_context(uuid) TO authenticated, anon;

-- 3. Drop the broad SELECT policy that exposed sensitive merchant columns to every logged-in user
DROP POLICY IF EXISTS "Authenticated users can view approved merchants" ON public.merchants;
