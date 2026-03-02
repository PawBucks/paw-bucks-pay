
-- Update availability function to support category filtering
CREATE OR REPLACE FUNCTION public.get_geo_cell_availability(
  p_geo_cell_id uuid, 
  p_service_id uuid,
  p_business_category text DEFAULT NULL
)
RETURNS TABLE(max_slots integer, used_slots bigint, available_slots bigint, time_window_days integer, business_category text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    gcsl.max_slots,
    COUNT(gcsr.id) AS used_slots,
    (gcsl.max_slots - COUNT(gcsr.id))::BIGINT AS available_slots,
    gcsl.time_window_days,
    gcsl.business_category
  FROM geo_cell_service_limits gcsl
  LEFT JOIN geo_cell_slot_reservations gcsr 
    ON gcsr.geo_cell_id = gcsl.geo_cell_id 
    AND gcsr.service_id = gcsl.service_id
    AND gcsr.is_active = true
    AND gcsr.expires_at > now()
    AND (gcsl.business_category IS NULL OR gcsr.business_category = gcsl.business_category)
  WHERE gcsl.geo_cell_id = p_geo_cell_id
    AND gcsl.service_id = p_service_id
    AND gcsl.is_active = true
    AND (
      p_business_category IS NULL 
      OR gcsl.business_category IS NULL 
      OR gcsl.business_category = p_business_category
    )
  GROUP BY gcsl.max_slots, gcsl.time_window_days, gcsl.business_category;
$$;
