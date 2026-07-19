DROP POLICY IF EXISTS "Vets can create pet allergies" ON public.pet_allergies;
CREATE POLICY "Vets can create pet allergies"
ON public.pet_allergies
FOR INSERT
TO authenticated
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

DROP POLICY IF EXISTS "Vets can create vaccination records" ON public.pet_vaccinations;
CREATE POLICY "Vets can create vaccination records"
ON public.pet_vaccinations
FOR INSERT
TO authenticated
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);