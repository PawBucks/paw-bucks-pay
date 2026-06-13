DROP POLICY IF EXISTS "Vets can send messages to their patients" ON public.vet_messages;

CREATE POLICY "Vets can send messages to authorized patients"
ON public.vet_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_type = 'vet'::message_sender_type
  AND vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND (
    -- Owner has already messaged this vet about this pet
    EXISTS (
      SELECT 1 FROM public.vet_messages prev
      WHERE prev.vet_id = vet_messages.vet_id
        AND prev.pet_id = vet_messages.pet_id
        AND prev.sender_type = 'owner'::message_sender_type
    )
    -- Or owner created a consent request with this vet for this pet
    OR EXISTS (
      SELECT 1 FROM public.pet_consent_requests pcr
      WHERE pcr.vet_id = vet_messages.vet_id
        AND pcr.pet_id = vet_messages.pet_id
    )
    -- Or owner explicitly shared care records with this vet
    OR EXISTS (
      SELECT 1 FROM public.vet_care_shares vcs
      WHERE vcs.vet_id = vet_messages.vet_id
        AND vcs.pet_id = vet_messages.pet_id
    )
  )
);