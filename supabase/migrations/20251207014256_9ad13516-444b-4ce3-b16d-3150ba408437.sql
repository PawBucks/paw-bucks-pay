-- Fix overly permissive "System can manage" policies on analytics tables
-- These currently allow ANY authenticated user to manage all analytics data

-- Drop the overly permissive policies
DROP POLICY IF EXISTS "System can manage customer analytics" ON public.merchant_customer_analytics;
DROP POLICY IF EXISTS "System can manage search analytics" ON public.merchant_search_analytics;

-- Create properly restricted policies that only allow service_role access
CREATE POLICY "Service role can manage customer analytics" 
ON public.merchant_customer_analytics 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Service role can manage search analytics" 
ON public.merchant_search_analytics 
FOR ALL 
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text)
WITH CHECK ((auth.jwt() ->> 'role'::text) = 'service_role'::text);