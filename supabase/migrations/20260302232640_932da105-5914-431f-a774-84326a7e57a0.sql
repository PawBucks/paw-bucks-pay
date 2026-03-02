
-- Step 1: Add business_category columns to both tables
ALTER TABLE public.geo_cell_service_limits
  ADD COLUMN IF NOT EXISTS business_category TEXT DEFAULT NULL;

ALTER TABLE public.geo_cell_slot_reservations
  ADD COLUMN IF NOT EXISTS business_category TEXT DEFAULT NULL;

-- Add unique constraint
ALTER TABLE public.geo_cell_service_limits
  ADD CONSTRAINT uq_geo_cell_service_category UNIQUE (geo_cell_id, service_id, business_category);
