
-- Create merchant business hours table
CREATE TABLE public.merchant_business_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (merchant_id, day_of_week)
);

-- Enable RLS
ALTER TABLE public.merchant_business_hours ENABLE ROW LEVEL SECURITY;

-- Anyone can view hours (public info)
CREATE POLICY "Anyone can view business hours"
  ON public.merchant_business_hours FOR SELECT
  USING (true);

-- Merchants can manage their own hours
CREATE POLICY "Merchants can insert their own hours"
  ON public.merchant_business_hours FOR INSERT
  WITH CHECK (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can update their own hours"
  ON public.merchant_business_hours FOR UPDATE
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchants can delete their own hours"
  ON public.merchant_business_hours FOR DELETE
  USING (public.user_owns_merchant(merchant_id));

-- Superadmins can manage all hours
CREATE POLICY "Superadmins can manage all hours"
  ON public.merchant_business_hours FOR ALL
  USING (public.is_superadmin(auth.uid()));

-- Timestamp trigger
CREATE TRIGGER update_merchant_business_hours_updated_at
  BEFORE UPDATE ON public.merchant_business_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Also create the same for partner vets
CREATE TABLE public.vet_business_hours (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  open_time TIME NOT NULL DEFAULT '09:00',
  close_time TIME NOT NULL DEFAULT '17:00',
  is_closed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (vet_id, day_of_week)
);

ALTER TABLE public.vet_business_hours ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vet hours"
  ON public.vet_business_hours FOR SELECT
  USING (true);

CREATE POLICY "Vets can insert their own hours"
  ON public.vet_business_hours FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM partner_vets WHERE id = vet_id AND user_id = auth.uid()));

CREATE POLICY "Vets can update their own hours"
  ON public.vet_business_hours FOR UPDATE
  USING (EXISTS (SELECT 1 FROM partner_vets WHERE id = vet_id AND user_id = auth.uid()));

CREATE POLICY "Vets can delete their own hours"
  ON public.vet_business_hours FOR DELETE
  USING (EXISTS (SELECT 1 FROM partner_vets WHERE id = vet_id AND user_id = auth.uid()));

CREATE POLICY "Superadmins can manage all vet hours"
  ON public.vet_business_hours FOR ALL
  USING (public.is_superadmin(auth.uid()));

CREATE TRIGGER update_vet_business_hours_updated_at
  BEFORE UPDATE ON public.vet_business_hours
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
