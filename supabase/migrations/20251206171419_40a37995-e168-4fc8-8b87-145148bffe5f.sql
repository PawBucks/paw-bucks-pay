-- Fix the security definer view issue by explicitly setting security_invoker
DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public 
WITH (security_invoker = true)
AS
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
    created_at
FROM merchants;

-- Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.merchants_public TO authenticated;
GRANT SELECT ON public.merchants_public TO anon;