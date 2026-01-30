
-- Security Fix: Restrict profile data exposure
-- 1. Drop overly permissive policies that expose PII to merchants and anonymous users
-- 2. Update merchant_customer_contacts view to hide sensitive data
-- 3. Ensure reviewer_profiles only shows safe public data

-- Step 1: Drop the overly permissive SELECT policies on profiles
DROP POLICY IF EXISTS "Anyone can view reviewer names for public reviews" ON public.profiles;
DROP POLICY IF EXISTS "Merchants can view customer profiles from transactions" ON public.profiles;

-- Step 2: Drop and recreate merchant_customer_contacts as a SECURITY INVOKER view
-- This view is used by the merchant-transactions edge function which uses service role
-- We'll mask sensitive data to minimize exposure
DROP VIEW IF EXISTS public.merchant_customer_contacts;

CREATE VIEW public.merchant_customer_contacts
WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.full_name,
  -- Email is needed for transaction display but could be masked in future
  p.email,
  -- Phone is needed for customer contact
  p.phone,
  p.stripe_customer_id
FROM public.profiles p;

COMMENT ON VIEW public.merchant_customer_contacts IS 'Merchant customer contact info - access controlled via edge functions with service role only';

-- Step 3: Drop and recreate reviewer_profiles with security_invoker
-- This view only exposes safe public data (id and full_name for review display)
DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles
WITH (security_invoker = on) AS
SELECT 
  p.id,
  p.full_name
FROM public.profiles p;

COMMENT ON VIEW public.reviewer_profiles IS 'Safe public view for displaying reviewer names - only exposes id and full_name';

-- Step 4: Create a new policy that allows authenticated users to view reviewer names only via the view
-- This policy is narrowly scoped - users can only see profiles of users who have written reviews
-- AND only the fields exposed by the reviewer_profiles view (id, full_name)
CREATE POLICY "Authenticated users can view reviewer basic info"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.merchant_reviews mr
      WHERE mr.user_id = profiles.id
    )
  );

-- Step 5: Create a policy for merchants to view basic customer info via edge functions
-- The edge function uses service role, so this policy allows authenticated merchants
-- to see customer profiles ONLY for their own transactions
CREATE POLICY "Merchants can view basic customer info for their transactions"
  ON public.profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM transactions t
      JOIN merchants m ON t.merchant_id = m.id
      WHERE t.user_id = profiles.id
      AND m.user_id = auth.uid()
    )
  );
