ALTER TABLE public.admin_invoices DROP CONSTRAINT IF EXISTS admin_invoices_recipient_type_check;
ALTER TABLE public.admin_invoices
ADD CONSTRAINT admin_invoices_recipient_type_check
CHECK (recipient_type = ANY (ARRAY['merchant'::text, 'vet'::text, 'brand'::text]));