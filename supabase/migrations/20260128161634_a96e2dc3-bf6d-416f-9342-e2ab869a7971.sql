
-- =====================================================
-- FINANCIAL FRICTION REMOVAL: Insurance & Wellness Plans
-- =====================================================

-- 1. Add missing columns to existing vet_wellness_plans table
ALTER TABLE public.vet_wellness_plans 
  ADD COLUMN IF NOT EXISTS merchant_id UUID REFERENCES public.merchants(id),
  ADD COLUMN IF NOT EXISTS species TEXT[] DEFAULT ARRAY['dog', 'cat'],
  ADD COLUMN IF NOT EXISTS monthly_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS annual_price NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS setup_fee NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS billing_interval TEXT DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS commitment_months INTEGER DEFAULT 12,
  ADD COLUMN IF NOT EXISTS stripe_product_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_price_id TEXT,
  ADD COLUMN IF NOT EXISTS total_value NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS savings_percentage NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS max_subscribers INTEGER,
  ADD COLUMN IF NOT EXISTS current_subscribers INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS terms_conditions TEXT,
  ADD COLUMN IF NOT EXISTS cancellation_policy TEXT;

-- Update monthly_price from price_usd for existing records
UPDATE public.vet_wellness_plans SET monthly_price = price_usd WHERE monthly_price IS NULL AND price_usd IS NOT NULL;

-- 2. Insurance Providers Table
CREATE TABLE public.vet_insurance_providers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT UNIQUE NOT NULL,
  api_endpoint TEXT,
  claim_submission_email TEXT,
  phone TEXT,
  website TEXT,
  supported_species TEXT[] DEFAULT ARRAY['dog', 'cat'],
  claim_form_url TEXT,
  average_processing_days INTEGER DEFAULT 14,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Pet Insurance Policies (linked to pets)
CREATE TABLE public.pet_insurance_policies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE CASCADE NOT NULL,
  provider_id UUID REFERENCES public.vet_insurance_providers(id) NOT NULL,
  policy_number TEXT NOT NULL,
  group_number TEXT,
  member_id TEXT,
  coverage_type TEXT CHECK (coverage_type IN ('accident', 'illness', 'wellness', 'comprehensive')) DEFAULT 'comprehensive',
  deductible_amount NUMERIC(10,2) DEFAULT 0,
  deductible_met NUMERIC(10,2) DEFAULT 0,
  copay_percentage NUMERIC(5,2) DEFAULT 20,
  annual_limit NUMERIC(12,2),
  annual_used NUMERIC(12,2) DEFAULT 0,
  effective_date DATE NOT NULL,
  expiration_date DATE,
  is_active BOOLEAN DEFAULT true,
  policy_holder_name TEXT,
  policy_holder_email TEXT,
  policy_holder_phone TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pet_id, provider_id, policy_number)
);

-- 4. Insurance Claims Table
CREATE TABLE public.insurance_claims (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id UUID REFERENCES public.pet_insurance_policies(id) NOT NULL,
  invoice_id UUID REFERENCES public.invoices(id),
  vet_id UUID REFERENCES public.partner_vets(id) NOT NULL,
  claim_number TEXT UNIQUE,
  claim_date DATE DEFAULT CURRENT_DATE,
  service_date DATE NOT NULL,
  diagnosis_codes TEXT[],
  procedure_codes TEXT[],
  total_amount NUMERIC(12,2) NOT NULL,
  covered_amount NUMERIC(12,2),
  copay_amount NUMERIC(12,2),
  deductible_applied NUMERIC(12,2) DEFAULT 0,
  owner_responsibility NUMERIC(12,2),
  status TEXT CHECK (status IN ('draft', 'pending_submission', 'submitted', 'under_review', 'approved', 'partially_approved', 'denied', 'paid', 'appealed')) DEFAULT 'draft',
  submission_method TEXT CHECK (submission_method IN ('electronic', 'email', 'fax', 'portal')) DEFAULT 'electronic',
  submitted_at TIMESTAMPTZ,
  processed_at TIMESTAMPTZ,
  paid_at TIMESTAMPTZ,
  payment_reference TEXT,
  denial_reason TEXT,
  notes TEXT,
  attachments TEXT[],
  claim_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. Services included in wellness plans (normalized)
CREATE TABLE public.vet_wellness_plan_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.vet_wellness_plans(id) ON DELETE CASCADE NOT NULL,
  service_name TEXT NOT NULL,
  service_category TEXT CHECK (service_category IN ('exam', 'vaccine', 'lab_work', 'dental', 'preventive', 'grooming', 'other')) DEFAULT 'other',
  quantity_included INTEGER DEFAULT 1,
  retail_value NUMERIC(10,2) NOT NULL,
  description TEXT,
  frequency TEXT CHECK (frequency IN ('per_year', 'per_visit', 'unlimited', 'as_needed')) DEFAULT 'per_year',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. Wellness Plan Subscriptions (Owner subscriptions)
CREATE TABLE public.wellness_plan_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID REFERENCES public.vet_wellness_plans(id) NOT NULL,
  user_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pet_profiles(id) NOT NULL,
  stripe_subscription_id TEXT,
  stripe_customer_id TEXT,
  status TEXT CHECK (status IN ('pending', 'active', 'paused', 'cancelled', 'expired', 'past_due')) DEFAULT 'pending',
  start_date DATE DEFAULT CURRENT_DATE,
  end_date DATE,
  next_billing_date DATE,
  monthly_amount NUMERIC(10,2) NOT NULL,
  total_paid NUMERIC(12,2) DEFAULT 0,
  total_rewards_earned INTEGER DEFAULT 0,
  services_used JSONB DEFAULT '{}',
  cancellation_date DATE,
  cancellation_reason TEXT,
  auto_renew BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(plan_id, pet_id)
);

-- 7. Wellness Plan Payment History
CREATE TABLE public.wellness_plan_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subscription_id UUID REFERENCES public.wellness_plan_subscriptions(id) ON DELETE CASCADE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_date TIMESTAMPTZ DEFAULT now(),
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  status TEXT CHECK (status IN ('pending', 'completed', 'failed', 'refunded')) DEFAULT 'pending',
  pawbucks_earned INTEGER DEFAULT 0,
  pawbucks_used INTEGER DEFAULT 0,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.vet_insurance_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_insurance_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_wellness_plan_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_plan_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wellness_plan_payments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vet_insurance_providers (public read, admin write)
CREATE POLICY "Anyone can view active insurance providers"
  ON public.vet_insurance_providers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can manage insurance providers"
  ON public.vet_insurance_providers FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for pet_insurance_policies
CREATE POLICY "Pet owners can view their pet insurance policies"
  ON public.pet_insurance_policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_insurance_policies.pet_id
      AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY "Pet owners can manage their pet insurance policies"
  ON public.pet_insurance_policies FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_insurance_policies.pet_id
      AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY "Pet owners can update their pet insurance policies"
  ON public.pet_insurance_policies FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_insurance_policies.pet_id
      AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY "Pet owners can delete their pet insurance policies"
  ON public.pet_insurance_policies FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_insurance_policies.pet_id
      AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can view patient insurance policies"
  ON public.pet_insurance_policies FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_vets pv
      WHERE pv.user_id = auth.uid()
    )
  );

-- RLS Policies for insurance_claims
CREATE POLICY "Pet owners can view their claims"
  ON public.insurance_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_insurance_policies pip
      JOIN public.pet_profiles pp ON pp.id = pip.pet_id
      WHERE pip.id = insurance_claims.policy_id
      AND pp.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can view claims they created"
  ON public.insurance_claims FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_vets pv
      WHERE pv.id = insurance_claims.vet_id
      AND pv.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can insert claims"
  ON public.insurance_claims FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.partner_vets pv
      WHERE pv.id = insurance_claims.vet_id
      AND pv.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can update their claims"
  ON public.insurance_claims FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.partner_vets pv
      WHERE pv.id = insurance_claims.vet_id
      AND pv.user_id = auth.uid()
    )
  );

-- RLS Policies for vet_wellness_plan_services
CREATE POLICY "Anyone can view wellness plan services"
  ON public.vet_wellness_plan_services FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.vet_wellness_plans vwp
      WHERE vwp.id = vet_wellness_plan_services.plan_id
      AND vwp.is_active = true
    )
  );

CREATE POLICY "Vets can insert their plan services"
  ON public.vet_wellness_plan_services FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.vet_wellness_plans vwp
      JOIN public.partner_vets pv ON pv.id = vwp.vet_id
      WHERE vwp.id = vet_wellness_plan_services.plan_id
      AND pv.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can update their plan services"
  ON public.vet_wellness_plan_services FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vet_wellness_plans vwp
      JOIN public.partner_vets pv ON pv.id = vwp.vet_id
      WHERE vwp.id = vet_wellness_plan_services.plan_id
      AND pv.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can delete their plan services"
  ON public.vet_wellness_plan_services FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vet_wellness_plans vwp
      JOIN public.partner_vets pv ON pv.id = vwp.vet_id
      WHERE vwp.id = vet_wellness_plan_services.plan_id
      AND pv.user_id = auth.uid()
    )
  );

-- RLS Policies for wellness_plan_subscriptions
CREATE POLICY "Users can view their own subscriptions"
  ON public.wellness_plan_subscriptions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own subscriptions"
  ON public.wellness_plan_subscriptions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own subscriptions"
  ON public.wellness_plan_subscriptions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Vets can view subscriptions to their plans"
  ON public.wellness_plan_subscriptions FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.vet_wellness_plans vwp
      JOIN public.partner_vets pv ON pv.id = vwp.vet_id
      WHERE vwp.id = wellness_plan_subscriptions.plan_id
      AND pv.user_id = auth.uid()
    )
  );

-- RLS Policies for wellness_plan_payments
CREATE POLICY "Users can view their own payments"
  ON public.wellness_plan_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wellness_plan_subscriptions wps
      WHERE wps.id = wellness_plan_payments.subscription_id
      AND wps.user_id = auth.uid()
    )
  );

CREATE POLICY "Vets can view payments for their plans"
  ON public.wellness_plan_payments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.wellness_plan_subscriptions wps
      JOIN public.vet_wellness_plans vwp ON vwp.id = wps.plan_id
      JOIN public.partner_vets pv ON pv.id = vwp.vet_id
      WHERE wps.id = wellness_plan_payments.subscription_id
      AND pv.user_id = auth.uid()
    )
  );

-- Seed common insurance providers
INSERT INTO public.vet_insurance_providers (name, code, claim_submission_email, website, supported_species) VALUES
  ('Nationwide Pet Insurance', 'NATIONWIDE', 'claims@petinsurance.com', 'https://www.petinsurance.com', ARRAY['dog', 'cat', 'bird', 'exotic']),
  ('Trupanion', 'TRUPANION', 'claims@trupanion.com', 'https://trupanion.com', ARRAY['dog', 'cat']),
  ('Healthy Paws', 'HEALTHYPAWS', 'claims@healthypawspetinsurance.com', 'https://www.healthypawspetinsurance.com', ARRAY['dog', 'cat']),
  ('Embrace Pet Insurance', 'EMBRACE', 'claims@embracepetinsurance.com', 'https://www.embracepetinsurance.com', ARRAY['dog', 'cat']),
  ('Petplan', 'PETPLAN', 'claims@gopetplan.com', 'https://www.gopetplan.com', ARRAY['dog', 'cat']),
  ('ASPCA Pet Health Insurance', 'ASPCA', 'claims@aspcapetinsurance.com', 'https://www.aspcapetinsurance.com', ARRAY['dog', 'cat']),
  ('Lemonade Pet', 'LEMONADE', 'claims@lemonade.com', 'https://www.lemonade.com/pet', ARRAY['dog', 'cat']),
  ('Spot Pet Insurance', 'SPOT', 'claims@spotpet.com', 'https://spotpet.com', ARRAY['dog', 'cat']),
  ('Figo Pet Insurance', 'FIGO', 'claims@figopetinsurance.com', 'https://figopetinsurance.com', ARRAY['dog', 'cat']),
  ('Pets Best', 'PETSBEST', 'claims@petsbest.com', 'https://www.petsbest.com', ARRAY['dog', 'cat']);

-- Create indexes for performance
CREATE INDEX idx_pet_insurance_policies_pet_id ON public.pet_insurance_policies(pet_id);
CREATE INDEX idx_insurance_claims_policy_id ON public.insurance_claims(policy_id);
CREATE INDEX idx_insurance_claims_status ON public.insurance_claims(status);
CREATE INDEX idx_vet_wellness_plan_services_plan_id ON public.vet_wellness_plan_services(plan_id);
CREATE INDEX idx_wellness_plan_subscriptions_user_id ON public.wellness_plan_subscriptions(user_id);
CREATE INDEX idx_wellness_plan_subscriptions_status ON public.wellness_plan_subscriptions(status);
CREATE INDEX idx_wellness_plan_payments_subscription_id ON public.wellness_plan_payments(subscription_id);

-- Function to generate claim numbers
CREATE OR REPLACE FUNCTION public.generate_claim_number()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  claim_num TEXT;
  num_exists BOOLEAN;
BEGIN
  LOOP
    claim_num := 'CLM-' || to_char(now(), 'YYYYMMDD') || '-' || upper(substr(md5(random()::text), 1, 6));
    SELECT EXISTS(SELECT 1 FROM insurance_claims WHERE claim_number = claim_num) INTO num_exists;
    EXIT WHEN NOT num_exists;
  END LOOP;
  RETURN claim_num;
END;
$$;

-- Trigger to auto-generate claim numbers
CREATE OR REPLACE FUNCTION public.set_claim_number()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.claim_number IS NULL THEN
    NEW.claim_number := generate_claim_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_set_claim_number
  BEFORE INSERT ON public.insurance_claims
  FOR EACH ROW
  EXECUTE FUNCTION public.set_claim_number();

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.wellness_plan_subscriptions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.insurance_claims;
