-- SECURITY FIX: Restrict direct access to merchants table to prevent PII exposure
-- The merchants_public view already correctly excludes sensitive columns (email, owner_name, contact_person)
-- But the direct RLS policy "Anyone can view approved merchants via public view" exposes ALL columns

-- 1. Drop the overly permissive public access policy on merchants table
DROP POLICY IF EXISTS "Anyone can view approved merchants via public view" ON public.merchants;

-- 2. The merchants_public view (with security_invoker=on) provides public access to approved merchants
-- It only exposes: id, business_name, business_type, description, logo_url, address, phone, 
-- cashback_rate, accepts_pawbucks, storefront_slug, price_range, is_sponsored, sponsored_until,
-- latitude, longitude, and social URLs - no email, owner_name, or contact_person

-- For unauthenticated users, they can ONLY access merchant data via the merchants_public view
-- The view needs security_invoker = off to allow unauthenticated access, but then we need 
-- to ensure the view itself is restrictive enough (which it already is)

-- Since the view has security_invoker=on, it needs an RLS policy to work for public access
-- Let's create a minimal policy that works with the view but prevents direct table access
-- by making it impossible to satisfy for direct table queries

-- Create a policy specifically for the view's limited column selection
-- This is tricky because RLS works at the row level, not column level

-- Alternative approach: Since we can't do column-level RLS, and we need public access,
-- we should disable security_invoker on the public view (it's already column-restricted)
-- and remove the direct table policy

-- Recreate the view without security_invoker to allow public access to safe columns only
DROP VIEW IF EXISTS merchants_public CASCADE;

CREATE VIEW public.merchants_public AS
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
WHERE approval_status = 'approved';

-- Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.merchants_public TO authenticated, anon;

COMMENT ON VIEW public.merchants_public IS 'Public-facing merchant data excluding sensitive contact info (email, owner_name, contact_person)';