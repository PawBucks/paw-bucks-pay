-- Fix System INSERT policies to only allow service_role

-- offer_redemptions: Drop and recreate with service_role check
DROP POLICY IF EXISTS "System can insert redemptions" ON public.offer_redemptions;
CREATE POLICY "Service role can insert redemptions"
ON public.offer_redemptions
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- offer_activity: Drop and recreate with service_role check
DROP POLICY IF EXISTS "System can insert offer activity" ON public.offer_activity;
CREATE POLICY "Service role can insert offer activity"
ON public.offer_activity
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- pawbucks_activity: Drop and recreate with service_role check
DROP POLICY IF EXISTS "System can insert activity" ON public.pawbucks_activity;
CREATE POLICY "Service role can insert activity"
ON public.pawbucks_activity
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- pawbucks_wallet: Drop and recreate with service_role check
DROP POLICY IF EXISTS "System can insert wallets" ON public.pawbucks_wallet;
CREATE POLICY "Service role can insert wallets"
ON public.pawbucks_wallet
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- loan_activity: Drop and recreate with service_role check
DROP POLICY IF EXISTS "System can insert loan activity" ON public.loan_activity;
CREATE POLICY "Service role can insert loan activity"
ON public.loan_activity
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- audit_logs: Drop and recreate with service_role check
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
CREATE POLICY "Service role can insert audit logs"
ON public.audit_logs
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');