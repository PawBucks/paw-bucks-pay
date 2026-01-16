-- Fix merchant_analytics_purchases admin policy to include superadmin
DROP POLICY IF EXISTS "Admins can view all purchases" ON public.merchant_analytics_purchases;

CREATE POLICY "Admins can view all purchases" 
ON public.merchant_analytics_purchases 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'superadmin'::app_role)
);

-- Fix merchant_analytics_subscriptions admin policy to include superadmin
DROP POLICY IF EXISTS "Admins can view all subscriptions" ON public.merchant_analytics_subscriptions;

CREATE POLICY "Admins can view all subscriptions" 
ON public.merchant_analytics_subscriptions 
FOR SELECT 
USING (
  has_role(auth.uid(), 'admin'::app_role) 
  OR has_role(auth.uid(), 'superadmin'::app_role)
);