-- Update RLS policies for pet_medical_records to allow shared account members to view
DROP POLICY IF EXISTS "Owners can view their pets' medical records" ON public.pet_medical_records;
CREATE POLICY "Owners and shared members can view medical records"
ON public.pet_medical_records
FOR SELECT
USING (auth.uid() = user_id OR is_shared_member_of(user_id));

-- Update RLS policies for pet_medical_visits to allow shared account members to view  
DROP POLICY IF EXISTS "Owners can view their pets' visits" ON public.pet_medical_visits;
CREATE POLICY "Owners and shared members can view visits"
ON public.pet_medical_visits
FOR SELECT
USING (auth.uid() = user_id OR is_shared_member_of(user_id));