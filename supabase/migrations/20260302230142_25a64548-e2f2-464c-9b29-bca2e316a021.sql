
-- Geo Cells: geographic zones for scarcity enforcement
CREATE TABLE public.geo_cells (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  center_latitude DOUBLE PRECISION NOT NULL,
  center_longitude DOUBLE PRECISION NOT NULL,
  radius_miles NUMERIC(5,2) NOT NULL DEFAULT 2.5,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scarcity limits: per geo_cell × service_category × time_window
CREATE TABLE public.geo_cell_service_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_cell_id UUID NOT NULL REFERENCES public.geo_cells(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.merchant_market_services(id) ON DELETE CASCADE,
  max_slots INTEGER NOT NULL DEFAULT 3,
  time_window_days INTEGER NOT NULL DEFAULT 30,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(geo_cell_id, service_id)
);

-- Track which merchant purchases consume slots in which cell
CREATE TABLE public.geo_cell_slot_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_cell_id UUID NOT NULL REFERENCES public.geo_cells(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES public.merchant_market_services(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  purchase_id UUID REFERENCES public.merchant_service_purchases(id) ON DELETE SET NULL,
  reserved_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_geo_cell_slots_lookup ON public.geo_cell_slot_reservations(geo_cell_id, service_id, is_active);
CREATE INDEX idx_geo_cell_slots_merchant ON public.geo_cell_slot_reservations(merchant_id, is_active);
CREATE INDEX idx_geo_cell_slots_expiry ON public.geo_cell_slot_reservations(expires_at) WHERE is_active = true;

-- Function to check available slots in a geo cell for a service
CREATE OR REPLACE FUNCTION public.get_geo_cell_availability(
  p_geo_cell_id UUID,
  p_service_id UUID
)
RETURNS TABLE(max_slots INTEGER, used_slots BIGINT, available_slots BIGINT, time_window_days INTEGER)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    gcsl.max_slots,
    COUNT(gcsr.id) AS used_slots,
    (gcsl.max_slots - COUNT(gcsr.id))::BIGINT AS available_slots,
    gcsl.time_window_days
  FROM geo_cell_service_limits gcsl
  LEFT JOIN geo_cell_slot_reservations gcsr 
    ON gcsr.geo_cell_id = gcsl.geo_cell_id 
    AND gcsr.service_id = gcsl.service_id
    AND gcsr.is_active = true
    AND gcsr.expires_at > now()
  WHERE gcsl.geo_cell_id = p_geo_cell_id
    AND gcsl.service_id = p_service_id
    AND gcsl.is_active = true
  GROUP BY gcsl.max_slots, gcsl.time_window_days;
$$;

-- Function to find which geo cell a merchant belongs to (by lat/lng proximity)
CREATE OR REPLACE FUNCTION public.get_merchant_geo_cell(p_merchant_id UUID)
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT gc.id
  FROM geo_cells gc
  JOIN merchants m ON m.id = p_merchant_id
  WHERE gc.is_active = true
    AND m.latitude IS NOT NULL
    AND m.longitude IS NOT NULL
    AND (
      -- Haversine approximation: 1 degree ≈ 69 miles at this latitude
      SQRT(
        POW((m.latitude - gc.center_latitude) * 69, 2) +
        POW((m.longitude - gc.center_longitude) * 54.6, 2)
      ) <= gc.radius_miles
    )
  ORDER BY 
    SQRT(
      POW((m.latitude - gc.center_latitude) * 69, 2) +
      POW((m.longitude - gc.center_longitude) * 54.6, 2)
    )
  LIMIT 1;
$$;

-- RLS
ALTER TABLE public.geo_cells ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cell_service_limits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.geo_cell_slot_reservations ENABLE ROW LEVEL SECURITY;

-- Public read on geo_cells (merchants need to see zones)
CREATE POLICY "Anyone can view active geo cells"
  ON public.geo_cells FOR SELECT
  USING (is_active = true);

-- Admin full access on geo_cells
CREATE POLICY "Admins manage geo cells"
  ON public.geo_cells FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Public read on limits (merchants see scarcity info)
CREATE POLICY "Anyone can view service limits"
  ON public.geo_cell_service_limits FOR SELECT
  USING (is_active = true);

-- Admin manage limits
CREATE POLICY "Admins manage service limits"
  ON public.geo_cell_service_limits FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Merchants see their own reservations, public sees counts
CREATE POLICY "Users view own reservations"
  ON public.geo_cell_slot_reservations FOR SELECT
  TO authenticated
  USING (
    merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_superadmin(auth.uid())
  );

-- Admin manage reservations
CREATE POLICY "Admins manage reservations"
  ON public.geo_cell_slot_reservations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Triggers for updated_at
CREATE TRIGGER update_geo_cells_updated_at
  BEFORE UPDATE ON public.geo_cells
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_geo_cell_service_limits_updated_at
  BEFORE UPDATE ON public.geo_cell_service_limits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
