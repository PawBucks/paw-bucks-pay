
-- Add a table for cross-category service caps per geo cell
CREATE TABLE IF NOT EXISTS public.geo_cell_service_total_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  geo_cell_id UUID NOT NULL REFERENCES geo_cells(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES merchant_market_services(id) ON DELETE CASCADE,
  max_total_slots INTEGER NOT NULL DEFAULT 3,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(geo_cell_id, service_id)
);

ALTER TABLE public.geo_cell_service_total_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read total caps"
  ON public.geo_cell_service_total_caps FOR SELECT
  USING (true);

-- Seed: max 3 Featured Partners total per geo cell
INSERT INTO geo_cell_service_total_caps (geo_cell_id, service_id, max_total_slots) VALUES
('8ceada9c-c109-44e6-9b46-bf656a329940', '20f9322b-185b-4e85-bf9e-a5ee15821293', 3),
('3366443d-d182-4d09-8faa-87577460920b', '20f9322b-185b-4e85-bf9e-a5ee15821293', 3),
('98989b5f-ddb7-4f33-b9ec-85d8f01f0724', '20f9322b-185b-4e85-bf9e-a5ee15821293', 3);
