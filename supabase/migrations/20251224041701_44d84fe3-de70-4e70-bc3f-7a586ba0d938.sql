-- Create table for merchant webhook configurations
CREATE TABLE public.merchant_webhooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Default Webhook',
  url TEXT NOT NULL,
  secret TEXT NOT NULL, -- For HMAC signature verification
  events TEXT[] NOT NULL DEFAULT ARRAY['transaction.created', 'reward.awarded'],
  is_active BOOLEAN NOT NULL DEFAULT true,
  last_triggered_at TIMESTAMP WITH TIME ZONE,
  failure_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create table for webhook delivery logs
CREATE TABLE public.webhook_delivery_logs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  webhook_id UUID NOT NULL REFERENCES public.merchant_webhooks(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INTEGER,
  response_body TEXT,
  success BOOLEAN NOT NULL DEFAULT false,
  duration_ms INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_webhooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webhook_delivery_logs ENABLE ROW LEVEL SECURITY;

-- RLS policies for merchant_webhooks
CREATE POLICY "Merchants can view their own webhooks"
ON public.merchant_webhooks FOR SELECT
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can create their own webhooks"
ON public.merchant_webhooks FOR INSERT
WITH CHECK (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own webhooks"
ON public.merchant_webhooks FOR UPDATE
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their own webhooks"
ON public.merchant_webhooks FOR DELETE
USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Service role can manage all webhooks"
ON public.merchant_webhooks FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- RLS policies for webhook_delivery_logs
CREATE POLICY "Merchants can view their webhook logs"
ON public.webhook_delivery_logs FOR SELECT
USING (webhook_id IN (
  SELECT id FROM merchant_webhooks 
  WHERE merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
));

CREATE POLICY "Service role can manage all webhook logs"
ON public.webhook_delivery_logs FOR ALL
USING ((auth.jwt() ->> 'role'::text) = 'service_role'::text);

-- Indexes for performance
CREATE INDEX idx_merchant_webhooks_merchant ON public.merchant_webhooks(merchant_id);
CREATE INDEX idx_webhook_logs_webhook ON public.webhook_delivery_logs(webhook_id);
CREATE INDEX idx_webhook_logs_created ON public.webhook_delivery_logs(created_at DESC);

-- Trigger for updated_at
CREATE TRIGGER update_merchant_webhooks_updated_at
BEFORE UPDATE ON public.merchant_webhooks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();