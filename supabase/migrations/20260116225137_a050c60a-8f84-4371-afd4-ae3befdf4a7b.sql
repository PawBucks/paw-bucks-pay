-- Add start_odometer and end_odometer columns to track trip start/end readings
ALTER TABLE public.merchant_mileage_log 
ADD COLUMN start_odometer NUMERIC DEFAULT NULL,
ADD COLUMN end_odometer NUMERIC DEFAULT NULL;

-- Add comment for clarity
COMMENT ON COLUMN public.merchant_mileage_log.start_odometer IS 'Odometer reading at trip start';
COMMENT ON COLUMN public.merchant_mileage_log.end_odometer IS 'Odometer reading at trip end';