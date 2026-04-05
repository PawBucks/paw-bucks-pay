-- Allow public access to admin_invoice_items for invoice payment page
CREATE POLICY "Public can view admin invoice items with valid invoice access"
ON public.admin_invoice_items
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_invoices
    WHERE admin_invoices.id = admin_invoice_items.invoice_id
  )
);

-- Allow public access to admin_invoice_payments for invoice payment page
CREATE POLICY "Public can view admin invoice payments with valid invoice access"
ON public.admin_invoice_payments
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.admin_invoices
    WHERE admin_invoices.id = admin_invoice_payments.invoice_id
  )
);
