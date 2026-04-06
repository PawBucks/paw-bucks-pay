-- Fix 1: Remove overly permissive admin_invoice_items policy that allows anyone with an invoice ID to read line items
DROP POLICY IF EXISTS "Public can view admin invoice items with valid invoice access" ON public.admin_invoice_items;

-- Fix 2: Restrict platform_settings to authenticated users only
DROP POLICY IF EXISTS "Everyone can view settings" ON public.platform_settings;
CREATE POLICY "Authenticated users can view settings"
ON public.platform_settings
FOR SELECT
TO authenticated
USING (true);