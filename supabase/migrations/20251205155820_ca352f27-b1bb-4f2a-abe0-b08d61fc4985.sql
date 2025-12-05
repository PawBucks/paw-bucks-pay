-- Drop and recreate the merchants_public view with SECURITY DEFINER
-- This allows the view to bypass RLS on the merchants table for public read access

DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public WITH (security_invoker = false) AS
SELECT 
    id,
    business_name,
    business_type,
    description,
    logo_url,
    address,
    latitude,
    longitude,
    cashback_rate,
    accepts_pawbucks,
    price_range,
    is_sponsored,
    sponsored_until,
    stripe_account_id,
    created_at
FROM merchants;

-- Grant SELECT on the view to all roles
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;