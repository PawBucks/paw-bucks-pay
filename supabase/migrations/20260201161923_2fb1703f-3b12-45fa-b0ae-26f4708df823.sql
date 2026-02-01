
-- FIX: Add RLS policy for service_bookings guest bookings
-- Ensure guest bookings (no user_id) can only be viewed by merchant
-- Using DROP/CREATE pattern since IF NOT EXISTS isn't supported

DROP POLICY IF EXISTS "Merchants can view guest bookings" ON public.service_bookings;

CREATE POLICY "Merchants can view guest bookings"
  ON public.service_bookings
  FOR SELECT
  USING (
    user_id IS NULL 
    AND merchant_id IN (
      SELECT id FROM merchants WHERE user_id = auth.uid()
    )
  );
