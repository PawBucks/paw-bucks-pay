-- Add flash sale columns to merchant_services table
ALTER TABLE public.merchant_services
ADD COLUMN IF NOT EXISTS is_flash_sale boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS flash_sale_pawbucks_price integer,
ADD COLUMN IF NOT EXISTS flash_sale_start_at timestamptz,
ADD COLUMN IF NOT EXISTS flash_sale_end_at timestamptz;

-- Add index for active flash sales queries
CREATE INDEX IF NOT EXISTS idx_merchant_services_flash_sale 
ON public.merchant_services (is_flash_sale, flash_sale_start_at, flash_sale_end_at)
WHERE is_flash_sale = true;

-- Create a table to track flash sale notifications sent
CREATE TABLE IF NOT EXISTS public.flash_sale_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  service_id uuid NOT NULL REFERENCES public.merchant_services(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  notification_type text NOT NULL DEFAULT 'flash_sale_live',
  sent_at timestamptz NOT NULL DEFAULT now(),
  recipients_count integer DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS on flash_sale_notifications
ALTER TABLE public.flash_sale_notifications ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own flash sale notifications
CREATE POLICY "Merchants can view own flash sale notifications"
ON public.flash_sale_notifications
FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Merchants can insert their own flash sale notifications
CREATE POLICY "Merchants can insert own flash sale notifications"
ON public.flash_sale_notifications
FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Add comment for documentation
COMMENT ON COLUMN public.merchant_services.is_flash_sale IS 'Whether this service currently has a flash sale active';
COMMENT ON COLUMN public.merchant_services.flash_sale_pawbucks_price IS 'Discounted PawBucks price during flash sale (in PawBucks units)';
COMMENT ON COLUMN public.merchant_services.flash_sale_start_at IS 'When the flash sale starts';
COMMENT ON COLUMN public.merchant_services.flash_sale_end_at IS 'When the flash sale ends';