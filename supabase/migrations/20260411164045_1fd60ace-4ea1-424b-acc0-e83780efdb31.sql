
-- Add deposit/no-show fields to merchant_services
ALTER TABLE public.merchant_services
ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS no_show_fee_amount NUMERIC(10,2) DEFAULT 0;

-- Add payment method tracking to service_bookings
ALTER TABLE public.service_bookings
ADD COLUMN IF NOT EXISTS stripe_payment_method_id TEXT,
ADD COLUMN IF NOT EXISTS stripe_setup_intent_id TEXT,
ADD COLUMN IF NOT EXISTS deposit_amount NUMERIC(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS deposit_status TEXT DEFAULT 'none';

-- Create no_show_charges table
CREATE TABLE public.no_show_charges (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  stripe_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  charged_by UUID,
  reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.no_show_charges ENABLE ROW LEVEL SECURITY;

-- Merchants can view charges for their bookings
CREATE POLICY "Merchants can view their no-show charges"
ON public.no_show_charges FOR SELECT
USING (public.user_owns_merchant(merchant_id));

-- Merchants can create charges
CREATE POLICY "Merchants can create no-show charges"
ON public.no_show_charges FOR INSERT
WITH CHECK (public.user_owns_merchant(merchant_id));

-- Merchants can update charges
CREATE POLICY "Merchants can update their no-show charges"
ON public.no_show_charges FOR UPDATE
USING (public.user_owns_merchant(merchant_id));

-- Users can view their own charges
CREATE POLICY "Users can view their own no-show charges"
ON public.no_show_charges FOR SELECT
USING (auth.uid() = user_id);

-- Timestamp trigger
CREATE TRIGGER update_no_show_charges_updated_at
BEFORE UPDATE ON public.no_show_charges
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
