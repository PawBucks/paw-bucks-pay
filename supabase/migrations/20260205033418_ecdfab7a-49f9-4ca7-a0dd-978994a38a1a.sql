-- Fix merchants_public view to use SECURITY INVOKER instead of SECURITY DEFINER
-- This ensures the view respects the querying user's RLS policies

-- Drop existing view
DROP VIEW IF EXISTS public.merchants_public;

-- Recreate with SECURITY INVOKER explicitly set
CREATE VIEW public.merchants_public WITH (security_invoker = on) AS
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
FROM merchants
WHERE approval_status = 'approved'::approval_status;

-- Grant SELECT to authenticated and anon users (public business directory)
GRANT SELECT ON public.merchants_public TO authenticated;
GRANT SELECT ON public.merchants_public TO anon;