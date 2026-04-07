
-- Drop the overly permissive policy
DROP POLICY IF EXISTS "Public can view admin invoice payments with valid invoice access" ON admin_invoice_payments;

-- Create a properly scoped policy: only the invoice recipient or superadmins can view payments
CREATE POLICY "Recipients and admins can view admin invoice payments"
ON admin_invoice_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM admin_invoices ai
    WHERE ai.id = admin_invoice_payments.invoice_id
    AND (
      ai.recipient_id = auth.uid()
      OR ai.created_by = auth.uid()
      OR public.is_superadmin(auth.uid())
    )
  )
);
