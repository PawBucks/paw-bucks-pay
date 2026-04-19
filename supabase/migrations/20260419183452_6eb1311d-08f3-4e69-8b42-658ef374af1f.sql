ALTER TABLE public.admin_invoices DROP CONSTRAINT IF EXISTS admin_invoices_invoice_type_check;
ALTER TABLE public.admin_invoices ADD CONSTRAINT admin_invoices_invoice_type_check
  CHECK (invoice_type IS NULL OR invoice_type IN ('merchant', 'vet', 'brand', 'brand_campaign', 'platform_fee', 'commission', 'subscription', 'service', 'other'));