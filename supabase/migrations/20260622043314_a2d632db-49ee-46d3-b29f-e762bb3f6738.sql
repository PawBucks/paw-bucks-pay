DROP POLICY IF EXISTS "Vets can view allergies for their patients" ON public.pet_allergies;

CREATE POLICY "Vets can view allergies for their patients"
ON public.pet_allergies
FOR SELECT
TO authenticated
USING (public.vet_can_view_pet(auth.uid(), pet_id));