-- Fix 1: Add webhook_secret column to vet_pms_integrations for signature verification
ALTER TABLE public.vet_pms_integrations 
ADD COLUMN IF NOT EXISTS webhook_secret text;

-- Add comment explaining the purpose
COMMENT ON COLUMN public.vet_pms_integrations.webhook_secret IS 'HMAC secret for verifying webhook signatures from PMS vendors';

-- Fix 2: Drop and recreate merchant_customer_contacts view with proper security
DROP VIEW IF EXISTS public.merchant_customer_contacts;

-- Create a security definer function to check if user owns a merchant
CREATE OR REPLACE FUNCTION public.user_owns_merchant(check_merchant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM merchants
    WHERE id = check_merchant_id AND user_id = auth.uid()
  )
$$;

-- Recreate view with RLS-friendly structure
CREATE VIEW public.merchant_customer_contacts
WITH (security_invoker = on)
AS
SELECT DISTINCT 
    p.id,
    t.merchant_id,
    p.full_name,
    p.email,
    p.phone,
    p.stripe_customer_id
FROM profiles p
JOIN transactions t ON t.user_id = p.id
WHERE t.status = 'completed'::text
  AND public.user_owns_merchant(t.merchant_id);

-- Grant access only to authenticated users
REVOKE ALL ON public.merchant_customer_contacts FROM anon;
GRANT SELECT ON public.merchant_customer_contacts TO authenticated;

-- Fix 3: Update overly permissive policies to be service-role only
-- These policies are for system operations and should restrict to service role

-- Drop and recreate guilt_badge_progress policy
DROP POLICY IF EXISTS "Service role can manage progress" ON public.guilt_badge_progress;
CREATE POLICY "Service role can manage progress"
ON public.guilt_badge_progress
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Drop and recreate guilt_badge_rewards policy  
DROP POLICY IF EXISTS "Service role can manage rewards" ON public.guilt_badge_rewards;
CREATE POLICY "Service role can manage rewards"
ON public.guilt_badge_rewards
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Drop and recreate user_guilt_badges policy
DROP POLICY IF EXISTS "Service role can manage user badges" ON public.user_guilt_badges;
CREATE POLICY "Service role can manage user badges"
ON public.user_guilt_badges
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Drop and recreate user_tier_status policy
DROP POLICY IF EXISTS "System can manage tier status" ON public.user_tier_status;
CREATE POLICY "System can manage tier status"
ON public.user_tier_status
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);