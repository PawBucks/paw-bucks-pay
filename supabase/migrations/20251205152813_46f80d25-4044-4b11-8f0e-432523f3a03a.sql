-- Fix wallet_activity INSERT policy to restrict to service_role only
-- This prevents authenticated users from injecting fake audit trail records
DROP POLICY IF EXISTS "System can insert wallet activity" ON public.wallet_activity;

CREATE POLICY "Only service role can insert wallet activity"
ON public.wallet_activity
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);