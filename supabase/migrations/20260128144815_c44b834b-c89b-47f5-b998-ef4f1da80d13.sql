-- Collaborative Care Network: Share medical notes with other merchants
CREATE TABLE public.vet_care_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  share_type TEXT NOT NULL CHECK (share_type IN ('medical_notes', 'behavioral', 'physical_limitations', 'allergies', 'medications', 'full_record')),
  notes TEXT,
  shared_data JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pet_id, vet_id, merchant_id, share_type)
);

-- Wellness Plans that vets can create
CREATE TABLE public.vet_wellness_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  pet_type TEXT NOT NULL CHECK (pet_type IN ('dog', 'cat', 'bird', 'other', 'all')),
  age_category TEXT CHECK (age_category IN ('puppy_kitten', 'adult', 'senior', 'all')),
  price_usd NUMERIC(10,2) NOT NULL,
  price_pawbucks INTEGER NOT NULL,
  services JSONB NOT NULL DEFAULT '[]',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Wellness Plan Purchases
CREATE TABLE public.wellness_plan_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES public.vet_wellness_plans(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('usd', 'pawbucks', 'combined')),
  amount_usd NUMERIC(10,2) DEFAULT 0,
  amount_pawbucks INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled', 'expired')),
  services_used JSONB DEFAULT '[]',
  valid_until TIMESTAMPTZ,
  purchased_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Lost Pet Alerts for Vets (using correct table name: lost_pet_posts)
CREATE TABLE public.vet_lost_pet_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  lost_pet_post_id UUID NOT NULL REFERENCES public.lost_pet_posts(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  alert_type TEXT NOT NULL DEFAULT 'lost' CHECK (alert_type IN ('lost', 'found', 'reunited')),
  is_acknowledged BOOLEAN DEFAULT false,
  acknowledged_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vet_care_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_wellness_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_plan_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_lost_pet_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vet_care_shares
CREATE POLICY "Vets can manage their care shares"
  ON public.vet_care_shares FOR ALL
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can view shares for them"
  ON public.vet_care_shares FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Pet owners can view shares for their pets"
  ON public.vet_care_shares FOR SELECT
  USING (pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid()));

-- RLS Policies for vet_wellness_plans
CREATE POLICY "Vets can manage their wellness plans"
  ON public.vet_wellness_plans FOR ALL
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Anyone can view active wellness plans"
  ON public.vet_wellness_plans FOR SELECT
  USING (is_active = true);

-- RLS Policies for wellness_plan_purchases
CREATE POLICY "Vets can view purchases for their plans"
  ON public.wellness_plan_purchases FOR SELECT
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can update purchases for their plans"
  ON public.wellness_plan_purchases FOR UPDATE
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Users can view their own purchases"
  ON public.wellness_plan_purchases FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create purchases"
  ON public.wellness_plan_purchases FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- RLS Policies for vet_lost_pet_alerts
CREATE POLICY "Vets can manage their lost pet alerts"
  ON public.vet_lost_pet_alerts FOR ALL
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- Indexes for performance
CREATE INDEX idx_vet_care_shares_pet ON public.vet_care_shares(pet_id);
CREATE INDEX idx_vet_care_shares_merchant ON public.vet_care_shares(merchant_id);
CREATE INDEX idx_vet_wellness_plans_vet ON public.vet_wellness_plans(vet_id);
CREATE INDEX idx_wellness_purchases_user ON public.wellness_plan_purchases(user_id);
CREATE INDEX idx_wellness_purchases_pet ON public.wellness_plan_purchases(pet_id);
CREATE INDEX idx_vet_lost_pet_alerts_vet ON public.vet_lost_pet_alerts(vet_id);
CREATE INDEX idx_vet_lost_pet_alerts_lost_pet ON public.vet_lost_pet_alerts(lost_pet_post_id);

-- Trigger for updated_at
CREATE TRIGGER update_vet_care_shares_updated_at
  BEFORE UPDATE ON public.vet_care_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vet_wellness_plans_updated_at
  BEFORE UPDATE ON public.vet_wellness_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_wellness_plan_purchases_updated_at
  BEFORE UPDATE ON public.wellness_plan_purchases
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();