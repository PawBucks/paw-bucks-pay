
-- =====================================================
-- FIX 1: Profiles table - Restrict public exposure
-- =====================================================

-- The "Allow reading reviewer profiles for review attribution" policy exposes PII (email, phone)
-- We need to create a secure view that only exposes safe fields for review attribution
-- and restrict direct table access

-- Drop the problematic policy that allows anon access
DROP POLICY IF EXISTS "Allow reading reviewer profiles for review attribution" ON public.profiles;

-- Create a secure view for reviewer profiles that only exposes safe fields
-- This view will be used by the application for review attribution
CREATE OR REPLACE VIEW public.reviewer_profiles 
WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.full_name,
  p.avatar_url
FROM public.profiles p
WHERE EXISTS (
  SELECT 1 FROM public.merchant_reviews mr WHERE mr.user_id = p.id
);

-- Grant SELECT on the view to authenticated and anon roles for review display
GRANT SELECT ON public.reviewer_profiles TO authenticated, anon;

-- Create a secure function to get reviewer profile by ID (for use in reviews display)
CREATE OR REPLACE FUNCTION public.get_reviewer_display_name(reviewer_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(p.full_name, 'Anonymous User')
  FROM public.profiles p
  WHERE p.id = reviewer_id
  AND EXISTS (SELECT 1 FROM public.merchant_reviews mr WHERE mr.user_id = p.id)
$$;

-- =====================================================
-- FIX 2: pet_health_access_codes - Restrict to authenticated only
-- =====================================================

-- Drop existing policies and recreate with authenticated role only
DROP POLICY IF EXISTS "Owners and shared members can view access codes" ON public.pet_health_access_codes;
DROP POLICY IF EXISTS "Owners and shared members can create access codes" ON public.pet_health_access_codes;
DROP POLICY IF EXISTS "Owners and shared members can update access codes" ON public.pet_health_access_codes;
DROP POLICY IF EXISTS "Owners and shared members can delete access codes" ON public.pet_health_access_codes;

-- Recreate with proper authenticated role restrictions
CREATE POLICY "Owners and shared members can view access codes"
ON public.pet_health_access_codes
FOR SELECT
TO authenticated
USING (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

CREATE POLICY "Owners and shared members can create access codes"
ON public.pet_health_access_codes
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

CREATE POLICY "Owners and shared members can update access codes"
ON public.pet_health_access_codes
FOR UPDATE
TO authenticated
USING (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

CREATE POLICY "Owners and shared members can delete access codes"
ON public.pet_health_access_codes
FOR DELETE
TO authenticated
USING (
  auth.uid() = owner_id 
  OR public.is_shared_member_of(owner_id)
);

-- =====================================================
-- FIX 3: Transactions - Tighten to authenticated only
-- =====================================================

-- Drop and recreate with authenticated role restrictions
DROP POLICY IF EXISTS "Users can view their own or shared transactions" ON public.transactions;
DROP POLICY IF EXISTS "Merchants can view their transactions" ON public.transactions;
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
DROP POLICY IF EXISTS "Only service role can create transactions" ON public.transactions;

-- Recreate with proper authenticated role restrictions
CREATE POLICY "Users can view their own or shared transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  auth.uid() = user_id 
  OR public.is_shared_member_of(user_id)
);

CREATE POLICY "Merchants can view their transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  auth.uid() IN (
    SELECT m.user_id FROM public.merchants m WHERE m.id = transactions.merchant_id
  )
);

CREATE POLICY "Admins can view all transactions"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

-- Service role insert - keep as service_role only
CREATE POLICY "Only service role can create transactions"
ON public.transactions
FOR INSERT
TO service_role
WITH CHECK (true);

-- =====================================================
-- FIX 4: Profiles - Restrict all policies to authenticated
-- =====================================================

-- Drop and recreate profile policies with authenticated role only
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Admins can update user types" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Merchants can view customer profiles for their transactions" ON public.profiles;
DROP POLICY IF EXISTS "Allow profile creation on signup" ON public.profiles;

-- Allow profile creation on signup (needed for auth trigger)
CREATE POLICY "Allow profile creation on signup"
ON public.profiles
FOR INSERT
TO authenticated, service_role
WITH CHECK (auth.uid() = id);

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
ON public.profiles
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
ON public.profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Merchants can view limited customer profiles for their transactions
CREATE POLICY "Merchants can view customer profiles for their transactions"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.transactions t
    JOIN public.merchants m ON t.merchant_id = m.id
    WHERE t.user_id = profiles.id 
    AND m.user_id = auth.uid() 
    AND t.status = 'completed'
  )
);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);

-- Admins can update user types
CREATE POLICY "Admins can update user types"
ON public.profiles
FOR UPDATE
TO authenticated
USING (
  public.has_role(auth.uid(), 'admin'::app_role) 
  OR public.has_role(auth.uid(), 'superadmin'::app_role)
);
