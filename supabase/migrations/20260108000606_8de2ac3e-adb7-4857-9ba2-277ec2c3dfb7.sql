-- Fix 1: Merchant PawBucks Wallet - Drop all existing policies and recreate with proper security
DROP POLICY IF EXISTS "Service role can manage merchant pawbucks wallets" ON public.merchant_pawbucks_wallet;
DROP POLICY IF EXISTS "Merchants can view their own pawbucks wallet" ON public.merchant_pawbucks_wallet;
DROP POLICY IF EXISTS "Admins can view all merchant wallets" ON public.merchant_pawbucks_wallet;

-- Create policy for merchants to view their own wallet (no public access)
CREATE POLICY "Merchants can view their own pawbucks wallet"
  ON public.merchant_pawbucks_wallet
  FOR SELECT
  USING (
    merchant_id IN (
      SELECT id FROM public.merchants WHERE user_id = auth.uid()
    )
  );

-- Create policy for admins to view all merchant wallets
CREATE POLICY "Admins can view all merchant wallets"
  ON public.merchant_pawbucks_wallet
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create restricted service role policy for system operations (INSERT/UPDATE/DELETE only)
-- This policy checks for actual service_role, not just any authenticated user
CREATE POLICY "Service role can manage merchant pawbucks wallets"
  ON public.merchant_pawbucks_wallet
  FOR ALL
  USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Fix 2: Audit Logs - Restrict INSERT to service role only
DROP POLICY IF EXISTS "System can insert audit logs" ON public.audit_logs;
DROP POLICY IF EXISTS "Service role can insert audit logs" ON public.audit_logs;

-- Only allow service role (via SECURITY DEFINER functions like log_admin_action) to insert
CREATE POLICY "Service role can insert audit logs"
  ON public.audit_logs
  FOR INSERT
  WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);