-- Drop and recreate merchants_public view with SECURITY INVOKER (default)
-- This ensures the view respects the caller's permissions

DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public AS
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
FROM public.merchants;

-- Grant SELECT to all necessary roles
GRANT SELECT ON public.merchants_public TO anon;
GRANT SELECT ON public.merchants_public TO authenticated;
GRANT SELECT ON public.merchants_public TO service_role;

-- Add a permissive RLS policy on the base merchants table for public read access via the view
-- First check if this policy exists, if not create it
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'merchants' 
        AND policyname = 'Public can view merchants via public view'
    ) THEN
        CREATE POLICY "Public can view merchants via public view"
        ON public.merchants
        FOR SELECT
        TO anon, authenticated
        USING (true);
    END IF;
END $$;