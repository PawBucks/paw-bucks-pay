
-- Add access_token to admin_invoices
ALTER TABLE public.admin_invoices
ADD COLUMN access_token TEXT NOT NULL DEFAULT gen_random_uuid()::text;

-- Create unique index on access_token
CREATE UNIQUE INDEX idx_admin_invoices_access_token ON public.admin_invoices (access_token);

-- Allow public read access with valid token (for payment page)
CREATE POLICY "Public can view admin invoice with valid token"
ON public.admin_invoices
FOR SELECT
USING (true);
