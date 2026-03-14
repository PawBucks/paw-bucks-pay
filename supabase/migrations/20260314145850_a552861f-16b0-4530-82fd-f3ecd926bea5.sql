
-- Verification questions that admin must answer per entity type
CREATE TABLE public.verification_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('merchant', 'vet')),
  question TEXT NOT NULL,
  description TEXT,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Admin answers for each pending entity
CREATE TABLE public.verification_answers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entity_type TEXT NOT NULL CHECK (entity_type IN ('merchant', 'vet')),
  entity_id UUID NOT NULL,
  question_id UUID NOT NULL REFERENCES public.verification_questions(id) ON DELETE CASCADE,
  answer TEXT NOT NULL CHECK (answer IN ('yes', 'no', 'na')),
  notes TEXT,
  answered_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, question_id)
);

-- RLS
ALTER TABLE public.verification_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.verification_answers ENABLE ROW LEVEL SECURITY;

-- Questions readable by admins
CREATE POLICY "Admins can read verification questions" ON public.verification_questions
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Answers: admin CRUD
CREATE POLICY "Admins can manage verification answers" ON public.verification_answers
FOR ALL TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
);

-- Seed merchant verification questions
INSERT INTO public.verification_questions (entity_type, question, description, display_order) VALUES
('merchant', 'Is the business legally registered?', 'Verify the business has a valid registration with their state/local government (LLC, Corp, DBA, etc.)', 1),
('merchant', 'Does the business have a valid business license?', 'Confirm an active, non-expired business license for their jurisdiction', 2),
('merchant', 'Is the business bonded?', 'Check if the business carries a surety bond appropriate for their industry', 3),
('merchant', 'Does the business carry general liability insurance?', 'Verify active general liability insurance coverage', 4),
('merchant', 'Does the business carry professional liability / E&O insurance?', 'If applicable to their business type, verify professional liability coverage', 5),
('merchant', 'Is the business in good standing with the BBB or equivalent?', 'Check for complaints, unresolved issues, or negative ratings', 6),
('merchant', 'Has the owner/operator passed identity verification?', 'Confirm the contact person matches the registered business owner or authorized representative', 7),
('merchant', 'Does the business have a physical location or verifiable address?', 'Confirm the business address is real and operational', 8),
('merchant', 'Is the business compliant with local pet-related regulations?', 'If selling pet products/services, verify compliance with any pet industry regulations', 9),
('merchant', 'Has the business provided valid tax identification (EIN/SSN)?', 'Confirm a valid tax ID was provided for 1099 reporting purposes', 10);

-- Seed vet verification questions
INSERT INTO public.verification_questions (entity_type, question, description, display_order) VALUES
('vet', 'Does the veterinarian hold a valid, active DVM/VMD license?', 'Verify the license number and state with the state veterinary medical board', 1),
('vet', 'Is the license in good standing with no disciplinary actions?', 'Check the state board for any suspensions, probations, or disciplinary history', 2),
('vet', 'Does the practice carry professional liability (malpractice) insurance?', 'Confirm active veterinary malpractice insurance coverage', 3),
('vet', 'Does the practice carry general liability insurance?', 'Verify general liability coverage for the clinic/practice', 4),
('vet', 'Is the practice DEA-registered for controlled substances?', 'Verify valid DEA registration if the practice dispenses controlled substances', 5),
('vet', 'Is the practice AAHA-accredited or equivalent?', 'Check for AAHA accreditation or equivalent quality certification', 6),
('vet', 'Does the practice have a valid NPI number?', 'Verify the National Provider Identifier if provided', 7),
('vet', 'Is the practice compliant with state veterinary practice act?', 'Confirm adherence to the state-specific veterinary practice act regulations', 8),
('vet', 'Has the veterinarian completed required continuing education?', 'Verify CE credits are up to date per state requirements', 9),
('vet', 'Does the practice have proper facility permits and inspections?', 'Confirm the clinic has passed required facility inspections and holds necessary permits', 10),
('vet', 'Is the practice bonded?', 'Check if the practice carries a surety bond', 11),
('vet', 'Has the owner/operator passed identity verification?', 'Confirm the applicant matches the licensed veterinarian or authorized practice manager', 12);
