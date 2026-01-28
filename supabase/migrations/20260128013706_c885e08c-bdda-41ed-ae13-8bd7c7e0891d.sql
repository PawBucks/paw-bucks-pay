-- =============================================
-- VET PORTAL EMR DATABASE SCHEMA
-- =============================================

-- Create enum for SOAP note types
CREATE TYPE public.soap_note_status AS ENUM ('draft', 'finalized', 'amended');

-- Create enum for consent form status
CREATE TYPE public.consent_status AS ENUM ('pending', 'signed', 'declined', 'expired');

-- Create enum for lab result status
CREATE TYPE public.lab_result_status AS ENUM ('pending', 'completed', 'reviewed');

-- Create enum for imaging type
CREATE TYPE public.imaging_type AS ENUM ('xray', 'ultrasound', 'mri', 'ct_scan', 'endoscopy', 'other');

-- =============================================
-- 1. PET ALLERGIES TABLE
-- =============================================
CREATE TABLE public.pet_allergies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE SET NULL,
  allergy_name TEXT NOT NULL,
  allergy_type TEXT NOT NULL, -- food, medication, environmental, other
  severity TEXT NOT NULL DEFAULT 'moderate', -- mild, moderate, severe
  reaction_description TEXT,
  first_observed_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 2. SURGICAL NOTES TABLE
-- =============================================
CREATE TABLE public.pet_surgical_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE RESTRICT,
  surgery_date TIMESTAMP WITH TIME ZONE NOT NULL,
  procedure_name TEXT NOT NULL,
  procedure_code TEXT,
  anesthesia_type TEXT,
  anesthesia_duration_minutes INTEGER,
  pre_op_notes TEXT,
  operative_notes TEXT NOT NULL,
  post_op_notes TEXT,
  complications TEXT,
  outcome TEXT NOT NULL DEFAULT 'successful', -- successful, complications, unsuccessful
  follow_up_required BOOLEAN NOT NULL DEFAULT true,
  follow_up_date DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 3. SOAP NOTES TABLE
-- =============================================
CREATE TABLE public.pet_soap_notes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE RESTRICT,
  visit_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Subjective: Owner's observations and history
  subjective_chief_complaint TEXT NOT NULL,
  subjective_history TEXT,
  subjective_duration TEXT,
  subjective_owner_observations TEXT,
  -- Objective: Clinical findings
  objective_temperature DECIMAL(5,2),
  objective_weight DECIMAL(8,2),
  objective_heart_rate INTEGER,
  objective_respiratory_rate INTEGER,
  objective_body_condition_score INTEGER, -- 1-9 scale
  objective_physical_exam TEXT NOT NULL,
  objective_findings TEXT,
  -- Assessment: Diagnosis/differential diagnoses
  assessment_primary_diagnosis TEXT NOT NULL,
  assessment_differential_diagnoses TEXT[],
  assessment_prognosis TEXT,
  -- Plan: Treatment plan
  plan_treatment TEXT NOT NULL,
  plan_medications TEXT,
  plan_follow_up TEXT,
  plan_client_education TEXT,
  plan_referral TEXT,
  -- Metadata
  status public.soap_note_status NOT NULL DEFAULT 'draft',
  finalized_at TIMESTAMP WITH TIME ZONE,
  amended_at TIMESTAMP WITH TIME ZONE,
  amendment_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 4. LAB RESULTS TABLE
-- =============================================
CREATE TABLE public.pet_lab_results (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE RESTRICT,
  soap_note_id UUID REFERENCES public.pet_soap_notes(id) ON DELETE SET NULL,
  test_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  lab_name TEXT,
  test_type TEXT NOT NULL, -- CBC, Chemistry Panel, Urinalysis, Fecal, etc.
  test_category TEXT NOT NULL, -- blood, urine, fecal, tissue, other
  results JSONB NOT NULL DEFAULT '{}', -- Structured results data
  result_summary TEXT,
  abnormal_flags TEXT[],
  interpretation TEXT,
  file_url TEXT,
  status public.lab_result_status NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.partner_vets(id),
  reviewed_at TIMESTAMP WITH TIME ZONE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 5. IMAGING RECORDS TABLE
-- =============================================
CREATE TABLE public.pet_imaging_records (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE RESTRICT,
  soap_note_id UUID REFERENCES public.pet_soap_notes(id) ON DELETE SET NULL,
  imaging_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  imaging_type public.imaging_type NOT NULL,
  body_region TEXT NOT NULL,
  views TEXT[], -- e.g., ['lateral', 'ventrodorsal']
  indication TEXT NOT NULL, -- reason for imaging
  findings TEXT,
  interpretation TEXT,
  radiologist_notes TEXT,
  image_urls TEXT[] NOT NULL DEFAULT '{}',
  thumbnail_url TEXT,
  is_abnormal BOOLEAN DEFAULT false,
  follow_up_recommended BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 6. CONSENT FORMS TEMPLATES TABLE
-- =============================================
CREATE TABLE public.vet_consent_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  template_name TEXT NOT NULL,
  template_type TEXT NOT NULL, -- surgery, anesthesia, treatment, euthanasia, general
  content TEXT NOT NULL, -- The consent form content/terms
  requires_witness BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 7. CONSENT REQUESTS TABLE (sent to pet owners)
-- =============================================
CREATE TABLE public.pet_consent_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  template_id UUID REFERENCES public.vet_consent_templates(id) ON DELETE SET NULL,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  -- Consent details
  consent_type TEXT NOT NULL, -- surgery, anesthesia, treatment, euthanasia, estimate
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  procedure_details TEXT,
  risks_disclosed TEXT,
  estimated_cost DECIMAL(10,2),
  cost_range_min DECIMAL(10,2),
  cost_range_max DECIMAL(10,2),
  -- Signature fields
  status public.consent_status NOT NULL DEFAULT 'pending',
  signature_data TEXT, -- Base64 encoded signature image
  signed_name TEXT,
  signed_at TIMESTAMP WITH TIME ZONE,
  signer_ip_address TEXT,
  signer_user_agent TEXT,
  -- Access control
  access_token TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  -- Metadata
  sent_via TEXT DEFAULT 'email', -- email, sms, in_app
  reminder_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- 8. VACCINATION RECORDS TABLE (enhanced)
-- =============================================
CREATE TABLE public.pet_vaccinations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE SET NULL,
  vaccine_name TEXT NOT NULL,
  vaccine_type TEXT NOT NULL, -- core, non-core, required
  manufacturer TEXT,
  lot_number TEXT,
  serial_number TEXT,
  administration_date DATE NOT NULL,
  expiration_date DATE,
  next_due_date DATE,
  administration_site TEXT,
  route TEXT, -- subcutaneous, intramuscular, intranasal
  dose TEXT,
  reaction_notes TEXT,
  administered_by TEXT,
  certificate_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- ENABLE ROW LEVEL SECURITY
-- =============================================
ALTER TABLE public.pet_allergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_surgical_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_soap_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_imaging_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_consent_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_consent_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_vaccinations ENABLE ROW LEVEL SECURITY;

-- =============================================
-- RLS POLICIES FOR PET ALLERGIES
-- =============================================
CREATE POLICY "Pet owners can view their pet allergies"
ON public.pet_allergies FOR SELECT
USING (
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
  OR public.is_shared_member_of((SELECT user_id FROM public.pet_profiles WHERE id = pet_id))
);

CREATE POLICY "Vets can view allergies for their patients"
ON public.pet_allergies FOR SELECT
USING (public.vet_can_view_pet((SELECT user_id FROM public.partner_vets WHERE id = vet_id), pet_id));

CREATE POLICY "Vets can create pet allergies"
ON public.pet_allergies FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.partner_vets WHERE user_id = auth.uid())
);

CREATE POLICY "Vets can update pet allergies they created"
ON public.pet_allergies FOR UPDATE
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR SURGICAL NOTES
-- =============================================
CREATE POLICY "Pet owners can view their pet surgical notes"
ON public.pet_surgical_notes FOR SELECT
USING (
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
  OR public.is_shared_member_of((SELECT user_id FROM public.pet_profiles WHERE id = pet_id))
);

CREATE POLICY "Vets can view surgical notes for their patients"
ON public.pet_surgical_notes FOR SELECT
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can create surgical notes"
ON public.pet_surgical_notes FOR INSERT
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can update their own surgical notes"
ON public.pet_surgical_notes FOR UPDATE
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR SOAP NOTES
-- =============================================
CREATE POLICY "Pet owners can view their pet SOAP notes"
ON public.pet_soap_notes FOR SELECT
USING (
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
  OR public.is_shared_member_of((SELECT user_id FROM public.pet_profiles WHERE id = pet_id))
);

CREATE POLICY "Vets can view SOAP notes they created"
ON public.pet_soap_notes FOR SELECT
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can create SOAP notes"
ON public.pet_soap_notes FOR INSERT
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can update draft SOAP notes"
ON public.pet_soap_notes FOR UPDATE
USING (
  vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
  AND (status = 'draft' OR status = 'finalized')
);

-- =============================================
-- RLS POLICIES FOR LAB RESULTS
-- =============================================
CREATE POLICY "Pet owners can view their pet lab results"
ON public.pet_lab_results FOR SELECT
USING (
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
  OR public.is_shared_member_of((SELECT user_id FROM public.pet_profiles WHERE id = pet_id))
);

CREATE POLICY "Vets can view lab results they created"
ON public.pet_lab_results FOR SELECT
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can create lab results"
ON public.pet_lab_results FOR INSERT
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can update lab results"
ON public.pet_lab_results FOR UPDATE
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR IMAGING RECORDS
-- =============================================
CREATE POLICY "Pet owners can view their pet imaging"
ON public.pet_imaging_records FOR SELECT
USING (
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
  OR public.is_shared_member_of((SELECT user_id FROM public.pet_profiles WHERE id = pet_id))
);

CREATE POLICY "Vets can view imaging they created"
ON public.pet_imaging_records FOR SELECT
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can create imaging records"
ON public.pet_imaging_records FOR INSERT
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can update imaging records"
ON public.pet_imaging_records FOR UPDATE
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR CONSENT TEMPLATES
-- =============================================
CREATE POLICY "Vets can manage their own consent templates"
ON public.vet_consent_templates FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR CONSENT REQUESTS
-- =============================================
CREATE POLICY "Pet owners can view consent requests for their pets"
ON public.pet_consent_requests FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Pet owners can update consent requests (sign)"
ON public.pet_consent_requests FOR UPDATE
USING (owner_id = auth.uid() AND status = 'pending');

CREATE POLICY "Vets can view consent requests they sent"
ON public.pet_consent_requests FOR SELECT
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can create consent requests"
ON public.pet_consent_requests FOR INSERT
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can update consent requests they created"
ON public.pet_consent_requests FOR UPDATE
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- RLS POLICIES FOR VACCINATIONS
-- =============================================
CREATE POLICY "Pet owners can view their pet vaccinations"
ON public.pet_vaccinations FOR SELECT
USING (
  pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid())
  OR public.is_shared_member_of((SELECT user_id FROM public.pet_profiles WHERE id = pet_id))
);

CREATE POLICY "Vets can view vaccinations for their patients"
ON public.pet_vaccinations FOR SELECT
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

CREATE POLICY "Vets can create vaccination records"
ON public.pet_vaccinations FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.partner_vets WHERE user_id = auth.uid())
);

CREATE POLICY "Vets can update vaccination records they created"
ON public.pet_vaccinations FOR UPDATE
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- =============================================
-- INDEXES FOR PERFORMANCE
-- =============================================
CREATE INDEX idx_pet_allergies_pet_id ON public.pet_allergies(pet_id);
CREATE INDEX idx_pet_surgical_notes_pet_id ON public.pet_surgical_notes(pet_id);
CREATE INDEX idx_pet_surgical_notes_vet_id ON public.pet_surgical_notes(vet_id);
CREATE INDEX idx_pet_soap_notes_pet_id ON public.pet_soap_notes(pet_id);
CREATE INDEX idx_pet_soap_notes_vet_id ON public.pet_soap_notes(vet_id);
CREATE INDEX idx_pet_soap_notes_visit_date ON public.pet_soap_notes(visit_date DESC);
CREATE INDEX idx_pet_lab_results_pet_id ON public.pet_lab_results(pet_id);
CREATE INDEX idx_pet_lab_results_test_date ON public.pet_lab_results(test_date DESC);
CREATE INDEX idx_pet_imaging_records_pet_id ON public.pet_imaging_records(pet_id);
CREATE INDEX idx_pet_consent_requests_owner_id ON public.pet_consent_requests(owner_id);
CREATE INDEX idx_pet_consent_requests_status ON public.pet_consent_requests(status);
CREATE INDEX idx_pet_vaccinations_pet_id ON public.pet_vaccinations(pet_id);
CREATE INDEX idx_pet_vaccinations_next_due ON public.pet_vaccinations(next_due_date);

-- =============================================
-- TRIGGERS FOR UPDATED_AT
-- =============================================
CREATE TRIGGER update_pet_allergies_updated_at
  BEFORE UPDATE ON public.pet_allergies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_surgical_notes_updated_at
  BEFORE UPDATE ON public.pet_surgical_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_soap_notes_updated_at
  BEFORE UPDATE ON public.pet_soap_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_lab_results_updated_at
  BEFORE UPDATE ON public.pet_lab_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_imaging_records_updated_at
  BEFORE UPDATE ON public.pet_imaging_records
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vet_consent_templates_updated_at
  BEFORE UPDATE ON public.vet_consent_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_consent_requests_updated_at
  BEFORE UPDATE ON public.pet_consent_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_vaccinations_updated_at
  BEFORE UPDATE ON public.pet_vaccinations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- STORAGE BUCKET FOR IMAGING
-- =============================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('vet-imaging', 'vet-imaging', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for vet imaging
CREATE POLICY "Vets can upload imaging files"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'vet-imaging' 
  AND EXISTS (SELECT 1 FROM public.partner_vets WHERE user_id = auth.uid())
);

CREATE POLICY "Users can view their pet imaging files"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'vet-imaging'
  AND (
    EXISTS (SELECT 1 FROM public.partner_vets WHERE user_id = auth.uid())
    OR auth.uid()::text = (storage.foldername(name))[1]
  )
);