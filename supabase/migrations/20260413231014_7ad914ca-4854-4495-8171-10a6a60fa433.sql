
CREATE TABLE public.brand_accounts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  brand_name TEXT NOT NULL,
  logo_url TEXT,
  contact_name TEXT,
  contact_email TEXT,
  description TEXT,
  website_url TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'inactive')),
  created_by UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_accounts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owners can view own brand" ON public.brand_accounts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Brand owners can update own brand" ON public.brand_accounts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage brand accounts" ON public.brand_accounts FOR ALL USING (public.is_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER update_brand_accounts_updated_at BEFORE UPDATE ON public.brand_accounts FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brand_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  brand_id UUID NOT NULL REFERENCES public.brand_accounts(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  budget_usd NUMERIC(12,2) NOT NULL DEFAULT 0,
  pawbucks_pool INTEGER NOT NULL DEFAULT 0,
  pawbucks_per_checkin INTEGER NOT NULL DEFAULT 500,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'pending_payment', 'active', 'paused', 'completed', 'expired')),
  start_date DATE,
  end_date DATE,
  total_distributed INTEGER NOT NULL DEFAULT 0,
  total_redeemed INTEGER NOT NULL DEFAULT 0,
  total_checkins INTEGER NOT NULL DEFAULT 0,
  admin_invoice_id UUID REFERENCES public.admin_invoices(id),
  campaign_color TEXT DEFAULT '#6366f1',
  campaign_logo_url TEXT,
  targeting_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.brand_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owners can view own campaigns" ON public.brand_campaigns FOR SELECT USING (EXISTS (SELECT 1 FROM public.brand_accounts ba WHERE ba.id = brand_campaigns.brand_id AND ba.user_id = auth.uid()));
CREATE POLICY "Brand owners can create campaigns" ON public.brand_campaigns FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM public.brand_accounts ba WHERE ba.id = brand_campaigns.brand_id AND ba.user_id = auth.uid()));
CREATE POLICY "Brand owners can update own campaigns" ON public.brand_campaigns FOR UPDATE USING (EXISTS (SELECT 1 FROM public.brand_accounts ba WHERE ba.id = brand_campaigns.brand_id AND ba.user_id = auth.uid()));
CREATE POLICY "Admins can manage brand campaigns" ON public.brand_campaigns FOR ALL USING (public.is_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER update_brand_campaigns_updated_at BEFORE UPDATE ON public.brand_campaigns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.brand_campaign_merchants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'invited' CHECK (status IN ('invited', 'active', 'declined', 'removed')),
  joined_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, merchant_id)
);
ALTER TABLE public.brand_campaign_merchants ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Brand owners can view campaign merchants" ON public.brand_campaign_merchants FOR SELECT USING (EXISTS (SELECT 1 FROM public.brand_campaigns bc JOIN public.brand_accounts ba ON ba.id = bc.brand_id WHERE bc.id = brand_campaign_merchants.campaign_id AND ba.user_id = auth.uid()));
CREATE POLICY "Merchants can view own participation" ON public.brand_campaign_merchants FOR SELECT USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = brand_campaign_merchants.merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Merchants can update own participation" ON public.brand_campaign_merchants FOR UPDATE USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = brand_campaign_merchants.merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Admins can manage campaign merchants" ON public.brand_campaign_merchants FOR ALL USING (public.is_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER update_brand_campaign_merchants_updated_at BEFORE UPDATE ON public.brand_campaign_merchants FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE POLICY "Merchants can view campaigns they participate in" ON public.brand_campaigns FOR SELECT USING (EXISTS (SELECT 1 FROM public.brand_campaign_merchants bcm JOIN public.merchants m ON m.id = bcm.merchant_id WHERE bcm.campaign_id = brand_campaigns.id AND m.user_id = auth.uid()));

CREATE TABLE public.branded_pawbucks_ledger (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  balance INTEGER NOT NULL DEFAULT 0,
  total_earned INTEGER NOT NULL DEFAULT 0,
  total_spent INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(campaign_id, user_id)
);
ALTER TABLE public.branded_pawbucks_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own branded balances" ON public.branded_pawbucks_ledger FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Brand owners can view campaign ledger" ON public.branded_pawbucks_ledger FOR SELECT USING (EXISTS (SELECT 1 FROM public.brand_campaigns bc JOIN public.brand_accounts ba ON ba.id = bc.brand_id WHERE bc.id = branded_pawbucks_ledger.campaign_id AND ba.user_id = auth.uid()));
CREATE POLICY "Admins can manage branded ledgers" ON public.branded_pawbucks_ledger FOR ALL USING (public.is_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));
CREATE TRIGGER update_branded_pawbucks_ledger_updated_at BEFORE UPDATE ON public.branded_pawbucks_ledger FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.branded_pawbucks_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL REFERENCES public.brand_campaigns(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  amount INTEGER NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id),
  checkin_id UUID REFERENCES public.checkins(id),
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
ALTER TABLE public.branded_pawbucks_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own branded activity" ON public.branded_pawbucks_activity FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Brand owners can view campaign activity" ON public.branded_pawbucks_activity FOR SELECT USING (EXISTS (SELECT 1 FROM public.brand_campaigns bc JOIN public.brand_accounts ba ON ba.id = bc.brand_id WHERE bc.id = branded_pawbucks_activity.campaign_id AND ba.user_id = auth.uid()));
CREATE POLICY "Merchants can view activity at their location" ON public.branded_pawbucks_activity FOR SELECT USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = branded_pawbucks_activity.merchant_id AND m.user_id = auth.uid()));
CREATE POLICY "Admins can manage branded activity" ON public.branded_pawbucks_activity FOR ALL USING (public.is_superadmin(auth.uid()) OR public.has_role(auth.uid(), 'superadmin'));

CREATE INDEX idx_brand_campaigns_brand_id ON public.brand_campaigns(brand_id);
CREATE INDEX idx_brand_campaigns_status ON public.brand_campaigns(status);
CREATE INDEX idx_brand_campaign_merchants_campaign_id ON public.brand_campaign_merchants(campaign_id);
CREATE INDEX idx_brand_campaign_merchants_merchant_id ON public.brand_campaign_merchants(merchant_id);
CREATE INDEX idx_branded_pawbucks_ledger_campaign_id ON public.branded_pawbucks_ledger(campaign_id);
CREATE INDEX idx_branded_pawbucks_ledger_user_id ON public.branded_pawbucks_ledger(user_id);
CREATE INDEX idx_branded_pawbucks_activity_campaign_id ON public.branded_pawbucks_activity(campaign_id);
CREATE INDEX idx_branded_pawbucks_activity_user_id ON public.branded_pawbucks_activity(user_id);
CREATE INDEX idx_branded_pawbucks_activity_merchant_id ON public.branded_pawbucks_activity(merchant_id);
