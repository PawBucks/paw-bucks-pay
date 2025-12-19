-- Remove the overly permissive policy that exposes all booking data
DROP POLICY IF EXISTS "Anyone can check slot availability" ON consultation_bookings;

-- Create a secure view that only exposes aggregated slot availability (no user data)
CREATE OR REPLACE VIEW public.consultation_slot_availability AS
SELECT 
  booking_date,
  time_slot,
  COUNT(*) as bookings_count
FROM public.consultation_bookings
WHERE status IN ('pending', 'confirmed')
GROUP BY booking_date, time_slot;

-- Grant public access to the view only
GRANT SELECT ON public.consultation_slot_availability TO anon, authenticated;