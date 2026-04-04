
-- Merchant campaigns table
CREATE TABLE public.merchant_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  channel TEXT NOT NULL CHECK (channel IN ('push', 'email', 'sms')),
  recipient_type TEXT NOT NULL DEFAULT 'all',
  recipient_count INTEGER NOT NULL DEFAULT 0,
  sent_count INTEGER NOT NULL DEFAULT 0,
  failed_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sending', 'sent', 'partial', 'failed')),
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_campaigns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own campaigns"
  ON public.merchant_campaigns FOR SELECT
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can create own campaigns"
  ON public.merchant_campaigns FOR INSERT
  WITH CHECK (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can update own campaigns"
  ON public.merchant_campaigns FOR UPDATE
  USING (public.user_owns_merchant(merchant_id));

CREATE TRIGGER update_merchant_campaigns_updated_at
  BEFORE UPDATE ON public.merchant_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Campaign recipients log
CREATE TABLE public.merchant_campaign_recipients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.merchant_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  phone TEXT,
  email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'simulated')),
  error_message TEXT,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own campaign recipients"
  ON public.merchant_campaign_recipients FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.merchant_campaigns mc
    WHERE mc.id = campaign_id AND public.user_owns_merchant(mc.merchant_id)
  ));

CREATE POLICY "Merchants can insert own campaign recipients"
  ON public.merchant_campaign_recipients FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.merchant_campaigns mc
    WHERE mc.id = campaign_id AND public.user_owns_merchant(mc.merchant_id)
  ));

CREATE INDEX idx_merchant_campaign_recipients_campaign ON public.merchant_campaign_recipients(campaign_id);

-- Merchant Twilio settings (for SMS campaigns)
CREATE TABLE public.merchant_twilio_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  twilio_account_sid TEXT NOT NULL,
  twilio_auth_token TEXT NOT NULL,
  twilio_phone_number TEXT NOT NULL,
  is_verified BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.merchant_twilio_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own twilio settings"
  ON public.merchant_twilio_settings FOR SELECT
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can insert own twilio settings"
  ON public.merchant_twilio_settings FOR INSERT
  WITH CHECK (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can update own twilio settings"
  ON public.merchant_twilio_settings FOR UPDATE
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can delete own twilio settings"
  ON public.merchant_twilio_settings FOR DELETE
  USING (public.user_owns_merchant(merchant_id));

CREATE TRIGGER update_merchant_twilio_settings_updated_at
  BEFORE UPDATE ON public.merchant_twilio_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for merchant campaigns
CREATE INDEX idx_merchant_campaigns_merchant ON public.merchant_campaigns(merchant_id);
CREATE INDEX idx_merchant_campaigns_status ON public.merchant_campaigns(status);
