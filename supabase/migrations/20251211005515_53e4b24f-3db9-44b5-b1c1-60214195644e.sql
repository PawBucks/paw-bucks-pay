-- Drop the existing check constraint
ALTER TABLE public.merchant_service_purchases 
DROP CONSTRAINT IF EXISTS merchant_service_purchases_status_check;

-- Add updated check constraint with all valid status values
ALTER TABLE public.merchant_service_purchases 
ADD CONSTRAINT merchant_service_purchases_status_check 
CHECK (status IN ('pending', 'active', 'paused', 'expired', 'cancelled', 'completed'));