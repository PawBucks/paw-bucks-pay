ALTER TABLE public.merchant_campaign_recipients ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.merchant_campaign_recipients ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.invoice_clients(id) ON DELETE SET NULL;
ALTER TABLE public.invoice_clients ADD COLUMN IF NOT EXISTS do_not_contact boolean NOT NULL DEFAULT false;