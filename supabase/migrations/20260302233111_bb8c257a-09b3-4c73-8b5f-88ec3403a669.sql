
-- Waitlist for oversubscribed geo cell slots
CREATE TABLE public.geo_cell_waitlist (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  geo_cell_id UUID NOT NULL REFERENCES geo_cells(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES merchant_market_services(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  business_category TEXT NOT NULL,
  purchase_id UUID REFERENCES merchant_service_purchases(id) ON DELETE SET NULL,
  position INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'waiting',  -- waiting, active, expired, cancelled
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  activated_at TIMESTAMPTZ,
  deactivated_at TIMESTAMPTZ,
  rotation_window_start TIMESTAMPTZ,
  rotation_window_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_waitlist_merchant_service_cell UNIQUE (geo_cell_id, service_id, merchant_id, business_category)
);

-- Enable RLS
ALTER TABLE public.geo_cell_waitlist ENABLE ROW LEVEL SECURITY;

-- Merchants can see their own waitlist entries
CREATE POLICY "Merchants can view own waitlist entries"
  ON public.geo_cell_waitlist FOR SELECT
  TO authenticated
  USING (merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

-- Public can see waitlist counts (for UI display)
CREATE POLICY "Anyone can view waitlist counts"
  ON public.geo_cell_waitlist FOR SELECT
  TO anon
  USING (true);

-- Only service role inserts/updates (via edge functions)
CREATE POLICY "Service role manages waitlist"
  ON public.geo_cell_waitlist FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Add rotation tracking to slot reservations
ALTER TABLE public.geo_cell_slot_reservations
  ADD COLUMN IF NOT EXISTS rotation_week INTEGER DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS waitlist_id UUID REFERENCES geo_cell_waitlist(id) ON DELETE SET NULL;

-- Index for efficient rotation queries
CREATE INDEX idx_waitlist_cell_service_status 
  ON geo_cell_waitlist(geo_cell_id, service_id, business_category, status, position);

-- Trigger for updated_at
CREATE TRIGGER update_geo_cell_waitlist_updated_at
  BEFORE UPDATE ON public.geo_cell_waitlist
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
