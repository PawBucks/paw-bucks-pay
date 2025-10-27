-- Create funding_deals table
CREATE TABLE IF NOT EXISTS public.funding_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  amount_funded NUMERIC NOT NULL,
  repayment_rate NUMERIC NOT NULL DEFAULT 10.00,
  total_repaid NUMERIC NOT NULL DEFAULT 0.00,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'paid_off', 'defaulted')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_funding_deals_merchant_id ON public.funding_deals(merchant_id);
CREATE INDEX idx_funding_deals_status ON public.funding_deals(status);

-- Enable RLS
ALTER TABLE public.funding_deals ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own funding deals
CREATE POLICY "Merchants can view their own funding deals"
ON public.funding_deals
FOR SELECT
USING (merchant_id IN (
  SELECT id FROM public.merchants WHERE user_id = auth.uid()
));

-- Admins can view all funding deals
CREATE POLICY "Admins can view all funding deals"
ON public.funding_deals
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Admins can insert funding deals
CREATE POLICY "Admins can insert funding deals"
ON public.funding_deals
FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Admins can update funding deals
CREATE POLICY "Admins can update funding deals"
ON public.funding_deals
FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

-- Service role can manage funding deals (for webhooks)
CREATE POLICY "Service role can manage funding deals"
ON public.funding_deals
FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role');

-- Add trigger for updated_at
CREATE TRIGGER update_funding_deals_updated_at
BEFORE UPDATE ON public.funding_deals
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();