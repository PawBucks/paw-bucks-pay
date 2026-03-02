
-- Remove admin access to pet medical records
DROP POLICY IF EXISTS "Admins can view all medical records" ON public.pet_medical_records;

-- Remove admin access to pet medical visits
DROP POLICY IF EXISTS "Admins can view all visits" ON public.pet_medical_visits;
