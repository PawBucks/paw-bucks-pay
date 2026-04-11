
-- Add mobile service flag to merchant_services
ALTER TABLE public.merchant_services 
ADD COLUMN IF NOT EXISTS is_mobile_service BOOLEAN DEFAULT false;

-- Add service area radius to merchants
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS service_area_radius_miles NUMERIC(5,1) DEFAULT 25.0;

-- Add location fields to service_bookings
ALTER TABLE public.service_bookings
ADD COLUMN IF NOT EXISTS service_address TEXT,
ADD COLUMN IF NOT EXISTS service_latitude NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS service_longitude NUMERIC(10,7),
ADD COLUMN IF NOT EXISTS location_notes TEXT;

-- Daily route plans for mobile merchants
CREATE TABLE public.merchant_route_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  route_date DATE NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft',
  total_distance_miles NUMERIC(8,2),
  total_duration_minutes INTEGER,
  estimated_savings_minutes INTEGER,
  optimized_order JSONB,
  mapbox_route_geometry TEXT,
  start_address TEXT,
  start_latitude NUMERIC(10,7),
  start_longitude NUMERIC(10,7),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(merchant_id, route_date)
);

-- Individual stops in a route
CREATE TABLE public.route_stops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  route_plan_id UUID NOT NULL REFERENCES public.merchant_route_plans(id) ON DELETE CASCADE,
  booking_id UUID REFERENCES public.service_bookings(id) ON DELETE SET NULL,
  stop_order INTEGER NOT NULL,
  address TEXT NOT NULL,
  latitude NUMERIC(10,7) NOT NULL,
  longitude NUMERIC(10,7) NOT NULL,
  estimated_arrival TIMESTAMPTZ,
  estimated_departure TIMESTAMPTZ,
  drive_duration_minutes INTEGER,
  drive_distance_miles NUMERIC(8,2),
  status TEXT NOT NULL DEFAULT 'pending',
  customer_name TEXT,
  service_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_route_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_stops ENABLE ROW LEVEL SECURITY;

-- Route plans: merchant owner access
CREATE POLICY "Merchants can manage their own route plans"
ON public.merchant_route_plans FOR ALL
USING (public.user_owns_merchant(merchant_id))
WITH CHECK (public.user_owns_merchant(merchant_id));

-- Route stops: merchant owner access via route plan
CREATE POLICY "Merchants can manage their own route stops"
ON public.route_stops FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM public.merchant_route_plans rp
    WHERE rp.id = route_stops.route_plan_id
    AND public.user_owns_merchant(rp.merchant_id)
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.merchant_route_plans rp
    WHERE rp.id = route_stops.route_plan_id
    AND public.user_owns_merchant(rp.merchant_id)
  )
);

-- Triggers for updated_at
CREATE TRIGGER update_merchant_route_plans_updated_at
BEFORE UPDATE ON public.merchant_route_plans
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_route_stops_updated_at
BEFORE UPDATE ON public.route_stops
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Index for fast lookups
CREATE INDEX idx_route_plans_merchant_date ON public.merchant_route_plans(merchant_id, route_date);
CREATE INDEX idx_route_stops_plan ON public.route_stops(route_plan_id, stop_order);
CREATE INDEX idx_bookings_service_location ON public.service_bookings(merchant_id, booking_date) WHERE service_latitude IS NOT NULL;
