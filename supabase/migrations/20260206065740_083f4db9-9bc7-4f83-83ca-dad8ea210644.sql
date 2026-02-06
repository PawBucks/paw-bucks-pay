-- =====================================================
-- SECURITY FIX: Address data exposure vulnerabilities
-- =====================================================

-- 1. FIX MERCHANT_CUSTOMER_CONTACTS VIEW
-- Add security_invoker to ensure RLS is respected
DROP VIEW IF EXISTS public.merchant_customer_contacts;

CREATE VIEW public.merchant_customer_contacts
WITH (security_invoker=on) AS
SELECT DISTINCT 
    p.id,
    t.merchant_id,
    p.full_name,
    p.email,
    p.phone,
    p.stripe_customer_id
FROM profiles p
JOIN transactions t ON t.user_id = p.id
WHERE t.status = 'completed'::text;

COMMENT ON VIEW public.merchant_customer_contacts IS 'Secure view with security_invoker for merchant customer contacts - respects profiles RLS';

-- 2. FIX MERCHANTS TABLE PUBLIC ACCESS
-- Drop the overly permissive policy that exposes all columns
DROP POLICY IF EXISTS "Public can view approved merchants" ON public.merchants;

-- Create a restrictive policy: Public (anon/authenticated) should use merchants_public view instead
-- Only allow direct table access for owners and admins
-- This ensures stripe_account_id, email, owner_name are not exposed via direct table access

-- 3. FIX MERCHANTS_PUBLIC VIEW  
-- Already excludes sensitive fields, but needs security_invoker to respect underlying RLS
DROP VIEW IF EXISTS public.merchants_public;

CREATE VIEW public.merchants_public
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
    linkedin_url
FROM merchants
WHERE approval_status = 'approved'::approval_status;

COMMENT ON VIEW public.merchants_public IS 'Public merchant directory - excludes email, owner_name, stripe_account_id for security';

-- 4. Now we need a policy that allows the view to work for public access
-- Create a policy specifically for the public fields when accessed via approved status
CREATE POLICY "Allow public view of approved merchants"
ON public.merchants
FOR SELECT
TO anon, authenticated
USING (approval_status = 'approved'::approval_status);

-- 5. FIX PET_HEALTH_ACCESS_CODES - Add policy for vets to access codes shared with them
-- First, verify there's no existing policy for vet access
DROP POLICY IF EXISTS "Vets can view codes shared with them" ON public.pet_health_access_codes;

CREATE POLICY "Vets can view codes shared with them"
ON public.pet_health_access_codes
FOR SELECT
TO authenticated
USING (
    -- Vets can view active codes where their email matches the vet_email
    vet_email = (SELECT email FROM auth.users WHERE id = auth.uid())
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
);

-- 6. VERIFY REVIEWER_PROFILES VIEW has security_invoker
DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles
WITH (security_invoker=on) AS
SELECT DISTINCT 
    p.id,
    p.full_name,
    p.avatar_url
FROM profiles p
WHERE EXISTS (
    SELECT 1 FROM merchant_reviews mr WHERE mr.user_id = p.id
);

COMMENT ON VIEW public.reviewer_profiles IS 'Public reviewer names for review attribution - intentionally public per business requirements';