GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invoices TO authenticated;
GRANT ALL ON public.admin_invoices TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invoice_items TO authenticated;
GRANT ALL ON public.admin_invoice_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.admin_invoice_payments TO authenticated;
GRANT ALL ON public.admin_invoice_payments TO service_role;