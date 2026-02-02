-- SECURITY FIX: Remove overly permissive RLS policies that expose all profile columns

-- 1. Drop the policy that exposes ALL profile columns for reviewers
-- The reviewer_profiles view already securely exposes only id, full_name, avatar_url
DROP POLICY IF EXISTS "Anyone can view reviewer basic info" ON public.profiles;

-- 2. Drop the merchant customer view policy - replace with more secure approach
-- Merchants should only see name and email for communication purposes
DROP POLICY IF EXISTS "Merchants can view basic customer info for their transactions" ON public.profiles;

-- 3. Create a more restrictive policy for merchants viewing their customer profiles
-- This only allows access to profiles of users who transacted with the merchant
-- The actual columns exposed should be controlled via the merchant_customer_contacts view
CREATE POLICY "Merchants can view customer profiles for their transactions" 
ON public.profiles 
FOR SELECT 
TO authenticated
USING (
  EXISTS (
    SELECT 1 
    FROM transactions t
    JOIN merchants m ON t.merchant_id = m.id
    WHERE t.user_id = profiles.id 
    AND m.user_id = auth.uid()
    AND t.status = 'completed'
  )
);

-- Note: The reviewer_profiles view (with security_invoker=on) already provides secure 
-- public access to reviewer names for review attribution, only exposing id, full_name, avatar_url.
-- The merchant_customer_contacts view (with security_invoker=on) will now respect 
-- the new tighter RLS policy, only showing data to the owning merchant.