-- Create direct_payments table to track direct charge transactions
CREATE TABLE public.direct_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_payment_intent_id TEXT NOT NULL UNIQUE,
  connected_account_id TEXT NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount INTEGER NOT NULL, -- Amount in cents
  application_fee INTEGER NOT NULL, -- Platform fee in cents (3%)
  currency TEXT NOT NULL DEFAULT 'usd',
  status TEXT NOT NULL DEFAULT 'pending', -- pending, succeeded, failed, refunded
  description TEXT,
  metadata JSONB,
  pawbucks_earned INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.direct_payments ENABLE ROW LEVEL SECURITY;

-- Admins can see all payments
CREATE POLICY "Admins can view all direct payments"
ON public.direct_payments
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Merchants can see their own payments
CREATE POLICY "Merchants can view their payments"
ON public.direct_payments
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m 
    WHERE m.id = direct_payments.merchant_id 
    AND m.user_id = auth.uid()
  )
);

-- Users can see their own payments
CREATE POLICY "Users can view their own payments"
ON public.direct_payments
FOR SELECT
USING (user_id = auth.uid());

-- Service role can insert/update (for webhooks)
CREATE POLICY "Service role can manage direct payments"
ON public.direct_payments
FOR ALL
USING (true)
WITH CHECK (true);

-- Enable realtime for direct payments
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_payments;

-- Add onboarding_complete to merchants if not exists
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT false;

-- Create updated_at trigger for direct_payments
CREATE TRIGGER update_direct_payments_updated_at
BEFORE UPDATE ON public.direct_payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();