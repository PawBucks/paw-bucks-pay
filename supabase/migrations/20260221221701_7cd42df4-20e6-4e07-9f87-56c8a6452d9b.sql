-- Allow pet owners to update their pet's email address (custom name)
CREATE POLICY "Pet owners can update their pet email addresses"
  ON public.pet_email_addresses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_email_addresses.pet_id
      AND pp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.pet_profiles pp
      WHERE pp.id = pet_email_addresses.pet_id
      AND pp.user_id = auth.uid()
    )
  );