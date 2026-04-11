
-- Grooming breed profiles: merchant-defined breed-specific pricing/duration
CREATE TABLE public.grooming_breed_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  breed_name TEXT NOT NULL,
  size_category TEXT NOT NULL DEFAULT 'medium',
  coat_type TEXT NOT NULL DEFAULT 'smooth',
  duration_minutes_override INTEGER,
  price_override NUMERIC(10,2),
  grooming_notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, breed_name)
);

ALTER TABLE public.grooming_breed_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view grooming breed profiles"
  ON public.grooming_breed_profiles FOR SELECT USING (true);

CREATE POLICY "Merchant owners can manage breed profiles"
  ON public.grooming_breed_profiles FOR INSERT
  WITH CHECK (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchant owners can update breed profiles"
  ON public.grooming_breed_profiles FOR UPDATE
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchant owners can delete breed profiles"
  ON public.grooming_breed_profiles FOR DELETE
  USING (public.user_owns_merchant(merchant_id));

CREATE TRIGGER update_grooming_breed_profiles_updated_at
  BEFORE UPDATE ON public.grooming_breed_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Groomer vaccine requirements: configurable per merchant
CREATE TABLE public.groomer_vaccine_requirements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  vaccine_name TEXT NOT NULL,
  enforcement_level TEXT NOT NULL DEFAULT 'warning',
  max_age_months INTEGER NOT NULL DEFAULT 12,
  description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, vaccine_name)
);

ALTER TABLE public.groomer_vaccine_requirements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view vaccine requirements"
  ON public.groomer_vaccine_requirements FOR SELECT USING (true);

CREATE POLICY "Merchant owners can manage vaccine requirements"
  ON public.groomer_vaccine_requirements FOR INSERT
  WITH CHECK (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchant owners can update vaccine requirements"
  ON public.groomer_vaccine_requirements FOR UPDATE
  USING (public.user_owns_merchant(merchant_id));

CREATE POLICY "Merchant owners can delete vaccine requirements"
  ON public.groomer_vaccine_requirements FOR DELETE
  USING (public.user_owns_merchant(merchant_id));

CREATE TRIGGER update_groomer_vaccine_requirements_updated_at
  BEFORE UPDATE ON public.groomer_vaccine_requirements
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grooming pet details: per-booking pet grooming metadata
CREATE TABLE public.grooming_pet_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES public.service_bookings(id) ON DELETE CASCADE,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  breed TEXT,
  weight_lbs NUMERIC(6,1),
  coat_type TEXT,
  coat_condition TEXT DEFAULT 'good',
  temperament_notes TEXT,
  special_instructions TEXT,
  vaccine_status JSONB DEFAULT '{}',
  adjusted_duration_minutes INTEGER,
  adjusted_price NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(booking_id)
);

ALTER TABLE public.grooming_pet_details ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pet owners and merchant owners can view grooming details"
  ON public.grooming_pet_details FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.service_bookings sb
      WHERE sb.id = booking_id
      AND (sb.user_id = auth.uid() OR public.user_owns_merchant(sb.merchant_id))
    )
  );

CREATE POLICY "Pet owners and merchant owners can insert grooming details"
  ON public.grooming_pet_details FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.service_bookings sb
      WHERE sb.id = booking_id
      AND (sb.user_id = auth.uid() OR public.user_owns_merchant(sb.merchant_id))
    )
  );

CREATE POLICY "Merchant owners can update grooming details"
  ON public.grooming_pet_details FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.service_bookings sb
      WHERE sb.id = booking_id
      AND public.user_owns_merchant(sb.merchant_id)
    )
  );

CREATE TRIGGER update_grooming_pet_details_updated_at
  BEFORE UPDATE ON public.grooming_pet_details
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for performance
CREATE INDEX idx_grooming_breed_profiles_merchant ON public.grooming_breed_profiles(merchant_id);
CREATE INDEX idx_groomer_vaccine_requirements_merchant ON public.groomer_vaccine_requirements(merchant_id);
CREATE INDEX idx_grooming_pet_details_booking ON public.grooming_pet_details(booking_id);
CREATE INDEX idx_grooming_pet_details_pet ON public.grooming_pet_details(pet_id);
