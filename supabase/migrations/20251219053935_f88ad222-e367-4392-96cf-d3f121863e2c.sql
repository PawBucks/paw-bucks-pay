-- Recreate view with SECURITY INVOKER to avoid security definer warning
DROP VIEW IF EXISTS public.consultation_slot_availability;

CREATE VIEW public.consultation_slot_availability 
WITH (security_invoker = true)
AS
SELECT 
  booking_date,
  time_slot,
  COUNT(*) as bookings_count
FROM public.consultation_bookings
WHERE status IN ('pending', 'confirmed')
GROUP BY booking_date, time_slot;

-- Grant public access to the view
GRANT SELECT ON public.consultation_slot_availability TO anon, authenticated;