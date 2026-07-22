
-- Tighten vet write policies to require an actual care relationship with the target pet

-- pet_medical_records
DROP POLICY IF EXISTS "Vets can insert medical records for their patients" ON public.pet_medical_records;
CREATE POLICY "Vets can insert medical records for their patients" ON public.pet_medical_records
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

-- pet_medical_visits
DROP POLICY IF EXISTS "Vets can insert visits for their patients" ON public.pet_medical_visits;
CREATE POLICY "Vets can insert visits for their patients" ON public.pet_medical_visits
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

-- pet_lab_results
DROP POLICY IF EXISTS "Vets can create lab results" ON public.pet_lab_results;
CREATE POLICY "Vets can create lab results" ON public.pet_lab_results
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
DROP POLICY IF EXISTS "Vets can update lab results" ON public.pet_lab_results;
CREATE POLICY "Vets can update lab results" ON public.pet_lab_results
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

-- pet_imaging_records
DROP POLICY IF EXISTS "Vets can create imaging records" ON public.pet_imaging_records;
CREATE POLICY "Vets can create imaging records" ON public.pet_imaging_records
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
DROP POLICY IF EXISTS "Vets can update imaging records" ON public.pet_imaging_records;
CREATE POLICY "Vets can update imaging records" ON public.pet_imaging_records
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

-- pet_surgical_notes
DROP POLICY IF EXISTS "Vets can create surgical notes" ON public.pet_surgical_notes;
CREATE POLICY "Vets can create surgical notes" ON public.pet_surgical_notes
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
DROP POLICY IF EXISTS "Vets can update their own surgical notes" ON public.pet_surgical_notes;
CREATE POLICY "Vets can update their own surgical notes" ON public.pet_surgical_notes
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

-- pet_soap_notes
DROP POLICY IF EXISTS "Vets can create SOAP notes" ON public.pet_soap_notes;
CREATE POLICY "Vets can create SOAP notes" ON public.pet_soap_notes
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
DROP POLICY IF EXISTS "Vets can update draft SOAP notes" ON public.pet_soap_notes;
CREATE POLICY "Vets can update draft SOAP notes" ON public.pet_soap_notes
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);

-- diagnostic_ai_analyses (split ALL into per-command policies with pet scope)
DROP POLICY IF EXISTS "Vets can manage their diagnostic analyses" ON public.diagnostic_ai_analyses;
CREATE POLICY "Vets can select their diagnostic analyses" ON public.diagnostic_ai_analyses
FOR SELECT TO authenticated USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
);
CREATE POLICY "Vets can insert diagnostic analyses for their patients" ON public.diagnostic_ai_analyses
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
CREATE POLICY "Vets can update diagnostic analyses for their patients" ON public.diagnostic_ai_analyses
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
CREATE POLICY "Vets can delete their diagnostic analyses" ON public.diagnostic_ai_analyses
FOR DELETE TO authenticated USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
);

-- external_lab_results
DROP POLICY IF EXISTS "Vets can manage external lab results" ON public.external_lab_results;
CREATE POLICY "Vets can select external lab results" ON public.external_lab_results
FOR SELECT TO authenticated USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
);
CREATE POLICY "Vets can insert external lab results for their patients" ON public.external_lab_results
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
CREATE POLICY "Vets can update external lab results for their patients" ON public.external_lab_results
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
CREATE POLICY "Vets can delete external lab results" ON public.external_lab_results
FOR DELETE TO authenticated USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
);

-- external_imaging_results
DROP POLICY IF EXISTS "Vets can manage external imaging results" ON public.external_imaging_results;
CREATE POLICY "Vets can select external imaging results" ON public.external_imaging_results
FOR SELECT TO authenticated USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
);
CREATE POLICY "Vets can insert external imaging results for their patients" ON public.external_imaging_results
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
CREATE POLICY "Vets can update external imaging results for their patients" ON public.external_imaging_results
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
CREATE POLICY "Vets can delete external imaging results" ON public.external_imaging_results
FOR DELETE TO authenticated USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
);

-- insurance_claims: resolve pet via pet_insurance_policies
DROP POLICY IF EXISTS "Vets can insert claims" ON public.insurance_claims;
CREATE POLICY "Vets can insert claims" ON public.insurance_claims
FOR INSERT TO authenticated WITH CHECK (
  EXISTS (SELECT 1 FROM public.partner_vets pv WHERE pv.id = insurance_claims.vet_id AND pv.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pet_insurance_policies p
    WHERE p.id = insurance_claims.policy_id
      AND public.vet_can_view_pet(auth.uid(), p.pet_id)
  )
);
DROP POLICY IF EXISTS "Vets can update their claims" ON public.insurance_claims;
CREATE POLICY "Vets can update their claims" ON public.insurance_claims
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.partner_vets pv WHERE pv.id = insurance_claims.vet_id AND pv.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pet_insurance_policies p
    WHERE p.id = insurance_claims.policy_id
      AND public.vet_can_view_pet(auth.uid(), p.pet_id)
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.partner_vets pv WHERE pv.id = insurance_claims.vet_id AND pv.user_id = auth.uid())
  AND EXISTS (
    SELECT 1 FROM public.pet_insurance_policies p
    WHERE p.id = insurance_claims.policy_id
      AND public.vet_can_view_pet(auth.uid(), p.pet_id)
  )
);

-- pet_consent_requests
DROP POLICY IF EXISTS "Vets can create consent requests" ON public.pet_consent_requests;
CREATE POLICY "Vets can create consent requests" ON public.pet_consent_requests
FOR INSERT TO authenticated WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
DROP POLICY IF EXISTS "Vets can update consent requests they created" ON public.pet_consent_requests;
CREATE POLICY "Vets can update consent requests they created" ON public.pet_consent_requests
FOR UPDATE TO authenticated
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
)
WITH CHECK (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND public.vet_can_view_pet(auth.uid(), pet_id)
);
