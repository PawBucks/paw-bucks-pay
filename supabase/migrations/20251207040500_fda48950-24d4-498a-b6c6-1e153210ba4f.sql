-- Remove the overly permissive RLS policy that exposes all merchant columns to anonymous users
-- Public access should go through the merchants_public view which only exposes non-sensitive fields

DROP POLICY IF EXISTS "Anyone can view basic merchant info" ON public.merchants;

-- The remaining policies correctly restrict access:
-- - "Merchants can view their own full record" (owner access)
-- - "Admins can view all merchants" (admin access)
-- - "Merchants can insert their own info" (owner insert)
-- - "Merchants can update their own info" (owner update)
-- - "Admins can update merchants" (admin update)