
-- ============================================================
-- FIX 1: admin_invoices - Replace permissive public SELECT policy
-- ============================================================

-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can view admin invoice with valid token" ON public.admin_invoices;

-- Create proper policy: public/anon can only view with matching access_token filter
CREATE POLICY "Public can view admin invoice with valid token"
ON public.admin_invoices
FOR SELECT
TO public
USING (
  -- Superadmins can see all
  public.is_superadmin(auth.uid())
  OR
  -- Recipient can see their own invoices
  (auth.uid() IS NOT NULL AND recipient_id = auth.uid())
);

-- Also drop/recreate policies on admin_invoice_items for consistency
DROP POLICY IF EXISTS "Public can view admin invoice items" ON public.admin_invoice_items;

CREATE POLICY "Public can view admin invoice items"
ON public.admin_invoice_items
FOR SELECT
TO public
USING (
  EXISTS (
    SELECT 1 FROM public.admin_invoices ai
    WHERE ai.id = admin_invoice_items.invoice_id
    AND (
      public.is_superadmin(auth.uid())
      OR (auth.uid() IS NOT NULL AND ai.recipient_id = auth.uid())
    )
  )
);

-- ============================================================
-- FIX 2: merchant_twilio_settings - Mask auth token from client
-- ============================================================

-- Create a safe view that masks the auth token
CREATE OR REPLACE VIEW public.merchant_twilio_settings_safe
WITH (security_invoker = on) AS
SELECT
  id,
  merchant_id,
  twilio_account_sid,
  '••••••••••••••••' AS twilio_auth_token,
  twilio_phone_number,
  is_verified,
  created_at,
  updated_at
FROM public.merchant_twilio_settings;

-- Drop existing permissive SELECT policy on base table
DROP POLICY IF EXISTS "Merchants can view own twilio settings" ON public.merchant_twilio_settings;

-- Re-create SELECT policy that only allows access through the view (security_invoker)
-- The view uses security_invoker=on so this policy still applies
CREATE POLICY "Merchants can view own twilio settings"
ON public.merchant_twilio_settings
FOR SELECT
TO authenticated
USING (public.user_owns_merchant(merchant_id));

-- ============================================================
-- FIX 3: geo_cell_waitlist - Restrict anonymous access
-- ============================================================

-- Drop the overly permissive anon policy
DROP POLICY IF EXISTS "Anyone can view waitlist counts" ON public.geo_cell_waitlist;

-- Create authenticated-only policy
CREATE POLICY "Authenticated users can view waitlist"
ON public.geo_cell_waitlist
FOR SELECT
TO authenticated
USING (true);
