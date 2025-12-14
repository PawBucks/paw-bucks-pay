-- Update profiles RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;
CREATE POLICY "Admins can view all profiles" 
ON public.profiles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update user types" ON public.profiles;
CREATE POLICY "Admins can update user types" 
ON public.profiles 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update merchants RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all merchants" ON public.merchants;
CREATE POLICY "Admins can view all merchants" 
ON public.merchants 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update merchants" ON public.merchants;
CREATE POLICY "Admins can update merchants" 
ON public.merchants 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update transactions RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all transactions" ON public.transactions;
CREATE POLICY "Admins can view all transactions" 
ON public.transactions 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update funding_requests RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all funding requests" ON public.funding_requests;
CREATE POLICY "Admins can view all funding requests" 
ON public.funding_requests 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update funding requests" ON public.funding_requests;
CREATE POLICY "Admins can update funding requests" 
ON public.funding_requests 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update audit_logs RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_logs;
CREATE POLICY "Admins can view audit logs" 
ON public.audit_logs 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update user_roles RLS policy to allow admins to view
DROP POLICY IF EXISTS "Admins can view all user roles" ON public.user_roles;
CREATE POLICY "Admins can view all user roles" 
ON public.user_roles 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update security_alerts RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all security alerts" ON public.security_alerts;
CREATE POLICY "Admins can view all security alerts" 
ON public.security_alerts 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update security alerts" ON public.security_alerts;
CREATE POLICY "Admins can update security alerts" 
ON public.security_alerts 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update auth_security_events RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all security events" ON public.auth_security_events;
CREATE POLICY "Admins can view all security events" 
ON public.auth_security_events 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update vet_loans RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all loans" ON public.vet_loans;
CREATE POLICY "Admins can view all loans" 
ON public.vet_loans 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can update loans" ON public.vet_loans;
CREATE POLICY "Admins can update loans" 
ON public.vet_loans 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update vet_messages RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all messages" ON public.vet_messages;
CREATE POLICY "Admins can view all messages" 
ON public.vet_messages 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update pet_medical_visits RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all visits" ON public.pet_medical_visits;
CREATE POLICY "Admins can view all visits" 
ON public.pet_medical_visits 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update loan_activity RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all loan activity" ON public.loan_activity;
CREATE POLICY "Admins can view all loan activity" 
ON public.loan_activity 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update offer_activity RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all offer activity" ON public.offer_activity;
CREATE POLICY "Admins can view all offer activity" 
ON public.offer_activity 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update partner_offers RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can manage all offers" ON public.partner_offers;
CREATE POLICY "Admins can manage all offers" 
ON public.partner_offers 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update partner_vets RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can manage partner vets" ON public.partner_vets;
CREATE POLICY "Admins can manage partner vets" 
ON public.partner_vets 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

DROP POLICY IF EXISTS "Admins can view all partner vets" ON public.partner_vets;
CREATE POLICY "Admins can view all partner vets" 
ON public.partner_vets 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update pet_store_orders RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all orders" ON public.pet_store_orders;
CREATE POLICY "Admins can view all orders" 
ON public.pet_store_orders 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update pet_store_order_items RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can view all order items" ON public.pet_store_order_items;
CREATE POLICY "Admins can view all order items" 
ON public.pet_store_order_items 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update platform_settings RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can manage settings" ON public.platform_settings;
CREATE POLICY "Admins can manage settings" 
ON public.platform_settings 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update merchant_analytics_products RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can manage analytics products" ON public.merchant_analytics_products;
CREATE POLICY "Admins can manage analytics products" 
ON public.merchant_analytics_products 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update merchant_market_services RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can manage merchant services" ON public.merchant_market_services;
CREATE POLICY "Admins can manage merchant services" 
ON public.merchant_market_services 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Update merchant_service_purchases RLS policy to include superadmins
DROP POLICY IF EXISTS "Admins can manage all purchases" ON public.merchant_service_purchases;
CREATE POLICY "Admins can manage all purchases" 
ON public.merchant_service_purchases 
FOR ALL 
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));