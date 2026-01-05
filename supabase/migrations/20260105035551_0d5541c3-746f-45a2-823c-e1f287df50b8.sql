-- Create merchant_pawbucks_wallet table for merchants to receive PawBucks from customer payments
CREATE TABLE public.merchant_pawbucks_wallet (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for faster lookups
CREATE INDEX idx_merchant_pawbucks_wallet_merchant_id ON public.merchant_pawbucks_wallet(merchant_id);

-- Enable RLS
ALTER TABLE public.merchant_pawbucks_wallet ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own wallet
CREATE POLICY "Merchants can view their own pawbucks wallet"
ON public.merchant_pawbucks_wallet
FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Policy: Only system (service role) can update balances
CREATE POLICY "Service role can manage merchant pawbucks wallets"
ON public.merchant_pawbucks_wallet
FOR ALL
USING (true)
WITH CHECK (true);

-- Create merchant_pawbucks_activity table to log all PawBucks transactions for merchants
CREATE TABLE public.merchant_pawbucks_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'spend', 'refund')),
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  description TEXT,
  customer_user_id UUID,
  transaction_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_merchant_pawbucks_activity_merchant_id ON public.merchant_pawbucks_activity(merchant_id);
CREATE INDEX idx_merchant_pawbucks_activity_created_at ON public.merchant_pawbucks_activity(created_at);

-- Enable RLS
ALTER TABLE public.merchant_pawbucks_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Merchants can view their own activity
CREATE POLICY "Merchants can view their own pawbucks activity"
ON public.merchant_pawbucks_activity
FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Trigger to update last_updated on merchant_pawbucks_wallet
CREATE OR REPLACE FUNCTION public.update_merchant_pawbucks_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_merchant_pawbucks_wallet_last_updated
BEFORE UPDATE ON public.merchant_pawbucks_wallet
FOR EACH ROW
EXECUTE FUNCTION public.update_merchant_pawbucks_wallet_timestamp();