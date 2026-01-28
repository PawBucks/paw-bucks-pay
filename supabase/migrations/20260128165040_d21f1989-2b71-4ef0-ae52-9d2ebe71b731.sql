-- Drop partially created tables first
DROP TABLE IF EXISTS public.vet_prescription_fulfillments;
DROP TABLE IF EXISTS public.vet_bonus_offers;

-- Table for tracking targeted bonus offers sent by vets
CREATE TABLE public.vet_bonus_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_type TEXT NOT NULL,
  bonus_amount INTEGER NOT NULL DEFAULT 500,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '30 days'),
  redeemed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for prescription fulfillment through PawBucks Store
CREATE TABLE public.vet_prescription_fulfillments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  refill_request_id UUID REFERENCES public.prescription_refill_requests(id),
  store_item_id UUID REFERENCES public.pet_store_items(id),
  medication_name TEXT NOT NULL,
  dosage TEXT NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1,
  instructions TEXT,
  vet_margin_percent NUMERIC(5,2) NOT NULL DEFAULT 15.00,
  product_price NUMERIC(10,2),
  vet_earnings NUMERIC(10,2),
  status TEXT NOT NULL DEFAULT 'pending_approval',
  approved_at TIMESTAMP WITH TIME ZONE,
  shipped_at TIMESTAMP WITH TIME ZONE,
  tracking_number TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vet_bonus_offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_prescription_fulfillments ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vet_bonus_offers
CREATE POLICY "Vets can manage their own bonus offers"
  ON public.vet_bonus_offers FOR ALL
  USING (EXISTS (SELECT 1 FROM public.partner_vets pv WHERE pv.id = vet_bonus_offers.vet_id AND pv.user_id = auth.uid()));

CREATE POLICY "Pet owners can view their bonus offers"
  ON public.vet_bonus_offers FOR SELECT
  USING (user_id = auth.uid());

-- RLS Policies for vet_prescription_fulfillments
CREATE POLICY "Vets can manage their prescription fulfillments"
  ON public.vet_prescription_fulfillments FOR ALL
  USING (EXISTS (SELECT 1 FROM public.partner_vets pv WHERE pv.id = vet_prescription_fulfillments.vet_id AND pv.user_id = auth.uid()));

CREATE POLICY "Pet owners can view their prescription fulfillments"
  ON public.vet_prescription_fulfillments FOR SELECT
  USING (user_id = auth.uid());

-- Triggers for updated_at
CREATE TRIGGER update_vet_bonus_offers_updated_at
  BEFORE UPDATE ON public.vet_bonus_offers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vet_prescription_fulfillments_updated_at
  BEFORE UPDATE ON public.vet_prescription_fulfillments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();