
-- =====================================================
-- AI Clinical Assistant Tables
-- =====================================================

-- AI SOAP Drafts - stores voice recordings and AI-generated SOAP content
CREATE TABLE public.ai_soap_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  soap_note_id UUID REFERENCES public.pet_soap_notes(id) ON DELETE SET NULL,
  
  -- Voice recording data
  audio_url TEXT,
  audio_duration_seconds INTEGER,
  transcription TEXT,
  transcription_confidence DECIMAL(3,2),
  
  -- AI-generated content
  ai_subjective TEXT,
  ai_objective TEXT,
  ai_suggested_assessment TEXT,
  ai_suggested_plan TEXT,
  
  -- Extracted clinical data
  extracted_vitals JSONB DEFAULT '{}',
  extracted_symptoms JSONB DEFAULT '[]',
  extracted_observations JSONB DEFAULT '[]',
  
  -- Status tracking
  status TEXT NOT NULL DEFAULT 'recording' CHECK (status IN ('recording', 'transcribing', 'generating', 'ready', 'applied', 'discarded')),
  applied_at TIMESTAMPTZ,
  
  -- Metadata
  model_used TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Symptom Triage Assessments - owner-submitted symptoms with AI analysis
CREATE TABLE public.symptom_triage_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE SET NULL,
  appointment_id UUID,
  
  -- Symptom questionnaire responses
  chief_complaint TEXT NOT NULL,
  symptom_duration TEXT,
  symptom_onset TEXT CHECK (symptom_onset IN ('sudden', 'gradual', 'unknown')),
  symptom_progression TEXT CHECK (symptom_progression IN ('improving', 'stable', 'worsening', 'fluctuating')),
  
  -- Detailed symptoms (structured)
  symptoms JSONB NOT NULL DEFAULT '[]',
  affected_body_areas JSONB DEFAULT '[]',
  behavioral_changes JSONB DEFAULT '[]',
  
  -- Vital observations by owner
  eating_status TEXT CHECK (eating_status IN ('normal', 'decreased', 'not_eating', 'increased')),
  drinking_status TEXT CHECK (drinking_status IN ('normal', 'decreased', 'not_drinking', 'increased')),
  energy_level TEXT CHECK (energy_level IN ('normal', 'low', 'very_low', 'hyperactive')),
  bathroom_habits TEXT CHECK (bathroom_habits IN ('normal', 'diarrhea', 'constipation', 'blood_present', 'straining', 'accidents')),
  
  -- Additional context
  recent_changes TEXT,
  current_medications TEXT,
  known_allergies TEXT,
  additional_notes TEXT,
  photo_urls TEXT[] DEFAULT '{}',
  
  -- AI Analysis Results
  ai_urgency_score INTEGER CHECK (ai_urgency_score >= 1 AND ai_urgency_score <= 10),
  ai_urgency_level TEXT CHECK (ai_urgency_level IN ('routine', 'soon', 'urgent', 'emergency')),
  ai_summary TEXT,
  ai_differential_considerations JSONB DEFAULT '[]',
  ai_recommended_questions JSONB DEFAULT '[]',
  ai_recommended_diagnostics JSONB DEFAULT '[]',
  ai_triage_reasoning TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'ready', 'reviewed', 'archived')),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES public.partner_vets(id),
  vet_notes TEXT,
  
  -- Metadata
  model_used TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Diagnostic AI Analyses - AI analysis of imaging/diagnostics
CREATE TABLE public.diagnostic_ai_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  
  -- Source reference
  imaging_record_id UUID REFERENCES public.pet_imaging_records(id) ON DELETE SET NULL,
  external_imaging_id UUID REFERENCES public.external_imaging_results(id) ON DELETE SET NULL,
  lab_result_id UUID REFERENCES public.pet_lab_results(id) ON DELETE SET NULL,
  external_lab_id UUID REFERENCES public.external_lab_results(id) ON DELETE SET NULL,
  
  -- Analysis type
  analysis_type TEXT NOT NULL CHECK (analysis_type IN ('xray', 'ultrasound', 'ct', 'mri', 'ecg', 'bloodwork', 'urinalysis', 'cytology', 'other')),
  image_urls TEXT[] DEFAULT '{}',
  
  -- AI Findings
  ai_findings JSONB NOT NULL DEFAULT '[]',
  ai_anomalies_detected JSONB DEFAULT '[]',
  ai_measurements JSONB DEFAULT '{}',
  ai_confidence_score DECIMAL(3,2),
  ai_summary TEXT,
  ai_recommendations TEXT,
  
  -- Structured anomaly data
  anomaly_regions JSONB DEFAULT '[]', -- [{x, y, width, height, label, confidence}]
  severity_assessment TEXT CHECK (severity_assessment IN ('normal', 'mild', 'moderate', 'severe', 'critical')),
  
  -- Vet review
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'analyzing', 'ready', 'reviewed', 'disputed', 'confirmed')),
  vet_agrees BOOLEAN,
  vet_corrections TEXT,
  vet_additional_findings TEXT,
  reviewed_at TIMESTAMPTZ,
  
  -- Metadata
  model_used TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Symptom library for questionnaire
CREATE TABLE public.symptom_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  category TEXT NOT NULL,
  symptom_name TEXT NOT NULL,
  symptom_description TEXT,
  follow_up_questions JSONB DEFAULT '[]',
  urgency_weight INTEGER DEFAULT 1,
  species_applicable TEXT[] DEFAULT '{dog, cat}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Insert common symptoms
INSERT INTO public.symptom_library (category, symptom_name, symptom_description, urgency_weight, species_applicable) VALUES
('gastrointestinal', 'Vomiting', 'Forceful expulsion of stomach contents', 3, '{dog, cat}'),
('gastrointestinal', 'Diarrhea', 'Loose or watery stools', 2, '{dog, cat}'),
('gastrointestinal', 'Loss of appetite', 'Decreased interest in food', 2, '{dog, cat}'),
('gastrointestinal', 'Blood in stool', 'Visible blood in feces', 5, '{dog, cat}'),
('respiratory', 'Coughing', 'Repeated forceful expulsion of air', 3, '{dog, cat}'),
('respiratory', 'Difficulty breathing', 'Labored or rapid breathing', 7, '{dog, cat}'),
('respiratory', 'Nasal discharge', 'Fluid from nose', 2, '{dog, cat}'),
('respiratory', 'Sneezing', 'Sudden forceful expulsion through nose', 1, '{dog, cat}'),
('musculoskeletal', 'Limping', 'Favoring one or more legs', 3, '{dog, cat}'),
('musculoskeletal', 'Difficulty walking', 'Trouble with normal movement', 4, '{dog, cat}'),
('musculoskeletal', 'Swelling', 'Visible enlargement of body part', 4, '{dog, cat}'),
('neurological', 'Seizures', 'Uncontrolled muscle movements', 8, '{dog, cat}'),
('neurological', 'Disorientation', 'Confusion or loss of balance', 5, '{dog, cat}'),
('neurological', 'Head tilt', 'Abnormal head positioning', 4, '{dog, cat}'),
('dermatological', 'Itching/scratching', 'Excessive scratching behavior', 2, '{dog, cat}'),
('dermatological', 'Hair loss', 'Patches of missing fur', 2, '{dog, cat}'),
('dermatological', 'Skin redness', 'Inflamed or irritated skin', 2, '{dog, cat}'),
('urinary', 'Frequent urination', 'Urinating more often than normal', 3, '{dog, cat}'),
('urinary', 'Blood in urine', 'Pink or red-tinged urine', 5, '{dog, cat}'),
('urinary', 'Straining to urinate', 'Difficulty passing urine', 6, '{dog, cat}'),
('behavioral', 'Lethargy', 'Unusual tiredness or weakness', 4, '{dog, cat}'),
('behavioral', 'Aggression', 'Unusual aggressive behavior', 3, '{dog, cat}'),
('behavioral', 'Hiding', 'Unusual hiding behavior', 3, '{dog, cat}'),
('ocular', 'Eye discharge', 'Fluid from eyes', 2, '{dog, cat}'),
('ocular', 'Red eyes', 'Bloodshot or inflamed eyes', 3, '{dog, cat}'),
('ocular', 'Squinting', 'Partially closing eyes', 3, '{dog, cat}'),
('cardiac', 'Collapse', 'Sudden loss of consciousness', 9, '{dog, cat}'),
('cardiac', 'Exercise intolerance', 'Tiring quickly during activity', 4, '{dog, cat}'),
('emergency', 'Trauma/injury', 'Physical injury from accident', 8, '{dog, cat}'),
('emergency', 'Possible toxin ingestion', 'May have eaten something harmful', 9, '{dog, cat}'),
('emergency', 'Bloated abdomen', 'Visibly distended stomach', 9, '{dog}');

-- Indexes for performance
CREATE INDEX idx_ai_soap_drafts_pet ON public.ai_soap_drafts(pet_id);
CREATE INDEX idx_ai_soap_drafts_vet ON public.ai_soap_drafts(vet_id);
CREATE INDEX idx_ai_soap_drafts_status ON public.ai_soap_drafts(status);
CREATE INDEX idx_symptom_triage_pet ON public.symptom_triage_assessments(pet_id);
CREATE INDEX idx_symptom_triage_owner ON public.symptom_triage_assessments(owner_id);
CREATE INDEX idx_symptom_triage_vet ON public.symptom_triage_assessments(vet_id);
CREATE INDEX idx_symptom_triage_status ON public.symptom_triage_assessments(status);
CREATE INDEX idx_symptom_triage_urgency ON public.symptom_triage_assessments(ai_urgency_level);
CREATE INDEX idx_diagnostic_ai_pet ON public.diagnostic_ai_analyses(pet_id);
CREATE INDEX idx_diagnostic_ai_vet ON public.diagnostic_ai_analyses(vet_id);
CREATE INDEX idx_diagnostic_ai_status ON public.diagnostic_ai_analyses(status);

-- RLS Policies
ALTER TABLE public.ai_soap_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_triage_assessments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.diagnostic_ai_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symptom_library ENABLE ROW LEVEL SECURITY;

-- AI SOAP Drafts policies (vets only)
CREATE POLICY "Vets can manage their AI SOAP drafts"
  ON public.ai_soap_drafts FOR ALL
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()))
  WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- Symptom Triage policies
CREATE POLICY "Owners can create and view their assessments"
  ON public.symptom_triage_assessments FOR ALL
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Vets can view and update assessments for their patients"
  ON public.symptom_triage_assessments FOR ALL
  USING (
    vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
    OR pet_id IN (
      SELECT DISTINCT vm.pet_id FROM vet_messages vm
      JOIN partner_vets pv ON pv.id = vm.vet_id
      WHERE pv.user_id = auth.uid()
    )
  );

-- Diagnostic AI policies (vets only)
CREATE POLICY "Vets can manage their diagnostic analyses"
  ON public.diagnostic_ai_analyses FOR ALL
  USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()))
  WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- Symptom library is public read
CREATE POLICY "Anyone can read symptom library"
  ON public.symptom_library FOR SELECT
  USING (is_active = true);

-- Triggers for updated_at
CREATE TRIGGER update_ai_soap_drafts_updated_at
  BEFORE UPDATE ON public.ai_soap_drafts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_symptom_triage_updated_at
  BEFORE UPDATE ON public.symptom_triage_assessments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_diagnostic_ai_updated_at
  BEFORE UPDATE ON public.diagnostic_ai_analyses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
