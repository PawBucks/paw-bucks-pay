-- Create enum for service categories
CREATE TYPE public.service_category AS ENUM (
  'daycare',
  'boarding',
  'grooming',
  'walking',
  'training',
  'veterinary',
  'pet_sitting',
  'other'
);

-- Create enum for booking status
CREATE TYPE public.booking_status AS ENUM (
  'pending',
  'confirmed',
  'cancelled',
  'completed',
  'no_show'
);

-- Create enum for payment type
CREATE TYPE public.payment_type AS ENUM (
  'pay_at_booking',
  'pay_at_service',
  'both'
);

-- Create merchant_services table - services merchants offer
CREATE TABLE public.merchant_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category service_category NOT NULL DEFAULT 'other',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  price NUMERIC NOT NULL DEFAULT 0,
  payment_type payment_type NOT NULL DEFAULT 'both',
  max_capacity INTEGER NOT NULL DEFAULT 1,
  requires_pet BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create merchant_availability table - weekly recurring hours
CREATE TABLE public.merchant_availability (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  slot_duration_minutes INTEGER NOT NULL DEFAULT 60,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_time_range CHECK (start_time < end_time)
);

-- Create merchant_availability_overrides table - specific date overrides
CREATE TABLE public.merchant_availability_overrides (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  override_date DATE NOT NULL,
  is_available BOOLEAN NOT NULL DEFAULT false, -- false = blocked, true = custom hours
  start_time TIME, -- null if is_available is false
  end_time TIME, -- null if is_available is false
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT valid_override_time CHECK (
    (is_available = false) OR (start_time IS NOT NULL AND end_time IS NOT NULL AND start_time < end_time)
  ),
  UNIQUE(merchant_id, override_date)
);

-- Create service_bookings table - customer bookings
CREATE TABLE public.service_bookings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES public.merchant_services(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  booking_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status booking_status NOT NULL DEFAULT 'pending',
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  total_price NUMERIC NOT NULL DEFAULT 0,
  notes TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  stripe_payment_intent_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create indexes for performance
CREATE INDEX idx_merchant_services_merchant ON public.merchant_services(merchant_id);
CREATE INDEX idx_merchant_services_category ON public.merchant_services(category);
CREATE INDEX idx_merchant_services_active ON public.merchant_services(is_active);
CREATE INDEX idx_merchant_availability_merchant ON public.merchant_availability(merchant_id);
CREATE INDEX idx_merchant_availability_day ON public.merchant_availability(day_of_week);
CREATE INDEX idx_availability_overrides_merchant_date ON public.merchant_availability_overrides(merchant_id, override_date);
CREATE INDEX idx_service_bookings_service ON public.service_bookings(service_id);
CREATE INDEX idx_service_bookings_merchant ON public.service_bookings(merchant_id);
CREATE INDEX idx_service_bookings_user ON public.service_bookings(user_id);
CREATE INDEX idx_service_bookings_date ON public.service_bookings(booking_date);
CREATE INDEX idx_service_bookings_status ON public.service_bookings(status);

-- Enable RLS
ALTER TABLE public.merchant_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_availability ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.merchant_availability_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_bookings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for merchant_services
CREATE POLICY "Anyone can view active services"
  ON public.merchant_services FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants can manage their own services"
  ON public.merchant_services FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all services"
  ON public.merchant_services FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

-- RLS Policies for merchant_availability
CREATE POLICY "Anyone can view active availability"
  ON public.merchant_availability FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants can manage their own availability"
  ON public.merchant_availability FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all availability"
  ON public.merchant_availability FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

-- RLS Policies for merchant_availability_overrides
CREATE POLICY "Anyone can view availability overrides"
  ON public.merchant_availability_overrides FOR SELECT
  USING (true);

CREATE POLICY "Merchants can manage their own overrides"
  ON public.merchant_availability_overrides FOR ALL
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all overrides"
  ON public.merchant_availability_overrides FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

-- RLS Policies for service_bookings
CREATE POLICY "Users can view their own bookings"
  ON public.service_bookings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create bookings"
  ON public.service_bookings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own bookings"
  ON public.service_bookings FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants can view their bookings"
  ON public.service_bookings FOR SELECT
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their bookings"
  ON public.service_bookings FOR UPDATE
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all bookings"
  ON public.service_bookings FOR ALL
  USING (has_role(auth.uid(), 'admin') OR has_role(auth.uid(), 'superadmin'));

-- Create trigger for updated_at
CREATE TRIGGER update_merchant_services_updated_at
  BEFORE UPDATE ON public.merchant_services
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_merchant_availability_updated_at
  BEFORE UPDATE ON public.merchant_availability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_availability_overrides_updated_at
  BEFORE UPDATE ON public.merchant_availability_overrides
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_bookings_updated_at
  BEFORE UPDATE ON public.service_bookings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();