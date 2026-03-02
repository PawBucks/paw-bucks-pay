
-- Drop the old unique constraint that doesn't include business_category
ALTER TABLE public.geo_cell_service_limits
  DROP CONSTRAINT IF EXISTS geo_cell_service_limits_geo_cell_id_service_id_key;
