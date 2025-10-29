-- Add user_id to partner_vets to link vet accounts
ALTER TABLE public.partner_vets
ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Add index for performance
CREATE INDEX idx_partner_vets_user_id ON public.partner_vets(user_id);

-- RLS policy for vets to insert medical records for their patients
CREATE POLICY "Vets can insert medical records for their patients"
  ON public.pet_medical_records
  FOR INSERT
  WITH CHECK (
    vet_id IN (
      SELECT id FROM public.partner_vets WHERE user_id = auth.uid()
    )
  );

-- RLS policy for vets to view medical records they created
CREATE POLICY "Vets can view medical records they created"
  ON public.pet_medical_records
  FOR SELECT
  USING (
    vet_id IN (
      SELECT id FROM public.partner_vets WHERE user_id = auth.uid()
    )
  );

-- RLS policy for vets to view pet profiles of their patients
CREATE POLICY "Vets can view their patients' pet profiles"
  ON public.pet_profiles
  FOR SELECT
  USING (
    id IN (
      SELECT DISTINCT pet_id 
      FROM public.vet_messages 
      WHERE vet_id IN (
        SELECT id FROM public.partner_vets WHERE user_id = auth.uid()
      )
    )
  );

-- RLS policy for vets to send messages
CREATE POLICY "Vets can send messages to their patients"
  ON public.vet_messages
  FOR INSERT
  WITH CHECK (
    vet_id IN (
      SELECT id FROM public.partner_vets WHERE user_id = auth.uid()
    ) AND sender_type = 'vet'
  );

-- RLS policy for vets to view their messages
CREATE POLICY "Vets can view their own messages"
  ON public.vet_messages
  FOR SELECT
  USING (
    vet_id IN (
      SELECT id FROM public.partner_vets WHERE user_id = auth.uid()
    )
  );