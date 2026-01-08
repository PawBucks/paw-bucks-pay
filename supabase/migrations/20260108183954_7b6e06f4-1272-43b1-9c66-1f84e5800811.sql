-- Fix remaining analytics daily stats tables with overly permissive policies
-- These tables allow unrestricted write access and need to be locked to service_role only

-- Drop overly permissive policies on daily stats tables
DROP POLICY IF EXISTS "Allow upserting daily stats" ON public.sponsored_placement_daily_stats;
DROP POLICY IF EXISTS "Allow upserting search ranking daily stats" ON public.search_ranking_daily_stats;

-- Create restricted policies for daily stats tables (service_role only)
CREATE POLICY "Service role can manage sponsored daily stats"
  ON public.sponsored_placement_daily_stats FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

CREATE POLICY "Service role can manage search ranking daily stats"
  ON public.search_ranking_daily_stats FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Fix direct_payments table - restrict mutations to service_role only
-- The existing policy "Service role can manage direct payments" uses USING(true) which is too permissive
DROP POLICY IF EXISTS "Service role can manage direct payments" ON public.direct_payments;

-- Create properly restricted service_role policy for direct_payments
CREATE POLICY "Service role can manage direct payments"
  ON public.direct_payments FOR ALL
  USING ((auth.jwt() ->> 'role') = 'service_role')
  WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Ensure SELECT access for users on their own direct payments
CREATE POLICY "Users can view their own direct payments"
  ON public.direct_payments FOR SELECT
  USING (auth.uid() = user_id);

-- Ensure merchants can view payments made to them
CREATE POLICY "Merchants can view payments to their account"
  ON public.direct_payments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = direct_payments.merchant_id
      AND m.user_id = auth.uid()
    )
  );