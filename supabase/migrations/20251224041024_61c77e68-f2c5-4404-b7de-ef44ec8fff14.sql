-- Create table for merchant POS API keys
CREATE TABLE public.merchant_pos_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  api_key_hash TEXT NOT NULL,
  api_key_prefix TEXT NOT NULL, -- First 8 chars for identification (e.g., "pk_live_")
  name TEXT NOT NULL DEFAULT 'Default POS',
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_used_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(api_key_hash)
);

-- Create table for POS transactions submitted via API
CREATE TABLE public.pos_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  integration_id UUID NOT NULL REFERENCES public.merchant_pos_integrations(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  external_transaction_id TEXT, -- ID from the POS system
  customer_email TEXT, -- To match with PawBucks users
  customer_phone TEXT,
  amount NUMERIC NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  items JSONB, -- Array of purchased items
  pos_timestamp TIMESTAMP WITH TIME ZONE, -- When transaction happened in POS
  status TEXT NOT NULL DEFAULT 'pending', -- pending, matched, rewarded, failed
  matched_user_id UUID, -- The PawBucks user who earned rewards
  pawbucks_awarded INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  processed_at TIMESTAMP WITH TIME ZONE,
  UNIQUE(integration_id, external_transaction_id)
);

-- Enable RLS
ALTER TABLE public.merchant_pos_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pos_transactions ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_pos_integrations
CREATE POLICY "Merchants can view their own integrations"
ON public.merchant_pos_integrations FOR SELECT
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can create their own integrations"
ON public.merchant_pos_integrations FOR INSERT
WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own integrations"
ON public.merchant_pos_integrations FOR UPDATE
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their own integrations"
ON public.merchant_pos_integrations FOR DELETE
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage all integrations"
ON public.merchant_pos_integrations FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS policies for pos_transactions
CREATE POLICY "Merchants can view their own POS transactions"
ON public.pos_transactions FOR SELECT
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage all POS transactions"
ON public.pos_transactions FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

CREATE POLICY "Admins can view all POS transactions"
ON public.pos_transactions FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

-- Create indexes for performance
CREATE INDEX idx_pos_integrations_merchant ON public.merchant_pos_integrations(merchant_id);
CREATE INDEX idx_pos_integrations_api_key_hash ON public.merchant_pos_integrations(api_key_hash);
CREATE INDEX idx_pos_transactions_merchant ON public.pos_transactions(merchant_id);
CREATE INDEX idx_pos_transactions_integration ON public.pos_transactions(integration_id);
CREATE INDEX idx_pos_transactions_customer_email ON public.pos_transactions(customer_email);
CREATE INDEX idx_pos_transactions_status ON public.pos_transactions(status);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_pos_integrations_updated_at
BEFORE UPDATE ON public.merchant_pos_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();