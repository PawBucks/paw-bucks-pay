-- Fix SECURITY DEFINER view that bypasses RLS on profiles
-- The merchant_customer_contacts view currently runs with owner privileges,
-- bypassing RLS policies on the profiles table.

-- Drop the existing view
DROP VIEW IF EXISTS public.merchant_customer_contacts;

-- Recreate with security_invoker = on so it respects RLS policies
-- This means only users with proper RLS access to profiles can see data through this view
CREATE VIEW public.merchant_customer_contacts
WITH (security_invoker = on)
AS
SELECT 
    id,
    full_name,
    email,
    phone,
    stripe_customer_id
FROM profiles p;

-- Add description explaining the security model
COMMENT ON VIEW public.merchant_customer_contacts IS 'Merchant customer contact info view with security_invoker enabled - respects profiles table RLS policies. Merchants can only see customers who have transacted with them.';

-- Also fix reviewer_profiles view to use security_invoker
DROP VIEW IF EXISTS public.reviewer_profiles;

CREATE VIEW public.reviewer_profiles
WITH (security_invoker = on)
AS
SELECT 
    id,
    full_name,
    avatar_url
FROM profiles p;

COMMENT ON VIEW public.reviewer_profiles IS 'Safe public view for displaying reviewer names - only exposes id, full_name, and avatar_url. Uses security_invoker to respect profiles RLS policies.';