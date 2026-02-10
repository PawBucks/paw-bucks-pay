
-- =====================================================
-- ENTERPRISE SECURITY HARDENING - Phase 1
-- =====================================================

-- 1. MERCHANTS TABLE: Remove public policy that exposes sensitive columns
--    (stripe_connected_account_id, owner email, etc.)
--    The merchants_public view will handle public access safely.
DROP POLICY IF EXISTS "Allow public view of approved merchants" ON public.merchants;

-- 2. Recreate merchants_public view WITHOUT security_invoker
--    so it can serve public data from the base table using definer permissions.
--    This view intentionally excludes: stripe_connected_account_id, 
--    owner_name, owner_email, email, tax_id, etc.
DROP VIEW IF EXISTS public.merchants_public;
CREATE VIEW public.merchants_public AS
  SELECT id,
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

-- Grant access to the view for anon and authenticated
GRANT SELECT ON public.merchants_public TO anon, authenticated;

-- 3. Partner vets: Ensure the public view also uses definer pattern
--    (it already has no public SELECT policy on base table, which is correct)
DROP VIEW IF EXISTS public.partner_vets_public;
CREATE VIEW public.partner_vets_public AS
  SELECT id,
    name,
    clinic_name,
    location,
    website_url,
    practice_type,
    accreditations,
    insurance_partners,
    direct_pay_enabled,
    accepting_new_patients,
    emergency_protocol
  FROM partner_vets
  WHERE approval_status = 'approved';

-- Grant access  
GRANT SELECT ON public.partner_vets_public TO anon, authenticated;

-- 4. Ensure pet owners can see approved partner vets through the view
--    for booking/discovery purposes (no base table access needed)
-- The partner_vets base table is already restricted to vets+admins only.

-- 5. Add missing anon denial for wallets base table
-- (wallets already requires auth.uid() match, but explicitly deny anon)
-- Already handled by existing RLS - auth.uid() is NULL for anon, no rows match.
