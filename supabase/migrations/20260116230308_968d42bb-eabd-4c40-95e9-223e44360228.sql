-- Add start_location and end_location columns to merchant_mileage_log
ALTER TABLE public.merchant_mileage_log
ADD COLUMN start_location TEXT DEFAULT NULL,
ADD COLUMN end_location TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.merchant_mileage_log.start_location IS 'Starting address/location for the trip';
COMMENT ON COLUMN public.merchant_mileage_log.end_location IS 'Ending/destination address for the trip';