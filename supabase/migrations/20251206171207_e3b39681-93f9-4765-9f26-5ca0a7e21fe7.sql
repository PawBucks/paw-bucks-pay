-- ============================================
-- FIX 1: Remove dangerous UPDATE policies on wallet tables
-- Users should NOT be able to directly modify their wallet balances
-- All balance changes must go through authenticated edge functions
-- ============================================

-- Remove the UPDATE policy on pawbucks_wallet that allows users to modify their balance
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.pawbucks_wallet;

-- Remove the UPDATE policy on wallets that allows users to modify their balance  
DROP POLICY IF EXISTS "Users can update their own wallet" ON public.wallets;

-- ============================================
-- FIX 2: Fix the SECURITY DEFINER view issue
-- Recreate merchants_public as a regular view (not security definer)
-- Also remove stripe_account_id as it shouldn't be public
-- ============================================

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
FROM merchants;

-- Grant SELECT on the view to authenticated and anon roles
GRANT SELECT ON public.merchants_public TO authenticated;
GRANT SELECT ON public.merchants_public TO anon;