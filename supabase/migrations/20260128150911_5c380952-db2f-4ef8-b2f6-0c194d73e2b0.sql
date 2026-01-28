-- PMS Integration configurations
CREATE TABLE public.vet_pms_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('idexx_cornerstone', 'idexx_neo', 'avimark', 'evetpractice', 'vetspire', 'other')),
  provider_name TEXT NOT NULL,
  api_key_encrypted TEXT,
  api_endpoint TEXT,
  client_id TEXT,
  practice_id TEXT,
  is_active BOOLEAN DEFAULT false,
  sync_direction TEXT NOT NULL DEFAULT 'bidirectional' CHECK (sync_direction IN ('read_only', 'write_only', 'bidirectional')),
  last_sync_at TIMESTAMPTZ,
  sync_frequency_minutes INTEGER DEFAULT 60,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PMS Sync logs
CREATE TABLE public.pms_sync_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.vet_pms_integrations(id) ON DELETE CASCADE,
  sync_type TEXT NOT NULL CHECK (sync_type IN ('full', 'incremental', 'webhook')),
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')),
  records_processed INTEGER DEFAULT 0,
  records_created INTEGER DEFAULT 0,
  records_updated INTEGER DEFAULT 0,
  records_failed INTEGER DEFAULT 0,
  error_message TEXT,
  details JSONB DEFAULT '{}',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);

-- External lab vendor integrations
CREATE TABLE public.vet_lab_integrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  lab_vendor TEXT NOT NULL CHECK (lab_vendor IN ('idexx', 'antech', 'zoetis', 'heska', 'abaxis', 'other')),
  lab_name TEXT NOT NULL,
  account_id TEXT,
  api_key_encrypted TEXT,
  api_endpoint TEXT,
  is_active BOOLEAN DEFAULT false,
  supports_dicom BOOLEAN DEFAULT false,
  auto_import BOOLEAN DEFAULT true,
  last_import_at TIMESTAMPTZ,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- External lab results (from integrated labs)
CREATE TABLE public.external_lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  lab_integration_id UUID REFERENCES public.vet_lab_integrations(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  external_patient_id TEXT,
  external_order_id TEXT NOT NULL,
  lab_vendor TEXT NOT NULL,
  test_name TEXT NOT NULL,
  test_code TEXT,
  test_category TEXT,
  result_date TIMESTAMPTZ NOT NULL,
  results JSONB NOT NULL DEFAULT '[]',
  reference_ranges JSONB DEFAULT '{}',
  has_abnormal_values BOOLEAN DEFAULT false,
  abnormal_flags TEXT[],
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preliminary', 'final', 'corrected', 'cancelled')),
  pdf_url TEXT,
  raw_data JSONB,
  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.partner_vets(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  linked_to_emr BOOLEAN DEFAULT false,
  emr_lab_result_id UUID REFERENCES public.pet_lab_results(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- External imaging/DICOM results
CREATE TABLE public.external_imaging_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  vet_id UUID NOT NULL REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  lab_integration_id UUID REFERENCES public.vet_lab_integrations(id) ON DELETE SET NULL,
  pet_id UUID REFERENCES public.pet_profiles(id) ON DELETE SET NULL,
  external_patient_id TEXT,
  external_study_id TEXT NOT NULL,
  lab_vendor TEXT NOT NULL,
  modality TEXT NOT NULL CHECK (modality IN ('xray', 'ultrasound', 'ct', 'mri', 'other')),
  body_part TEXT,
  study_description TEXT,
  study_date TIMESTAMPTZ NOT NULL,
  dicom_viewer_url TEXT,
  thumbnail_url TEXT,
  image_count INTEGER DEFAULT 1,
  radiologist_report TEXT,
  findings JSONB DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preliminary', 'final', 'corrected')),
  is_reviewed BOOLEAN DEFAULT false,
  reviewed_by UUID REFERENCES public.partner_vets(id),
  reviewed_at TIMESTAMPTZ,
  notes TEXT,
  linked_to_emr BOOLEAN DEFAULT false,
  emr_imaging_id UUID REFERENCES public.pet_imaging_records(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- PMS field mappings (for data transformation)
CREATE TABLE public.pms_field_mappings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id UUID NOT NULL REFERENCES public.vet_pms_integrations(id) ON DELETE CASCADE,
  pawbucks_entity TEXT NOT NULL,
  pawbucks_field TEXT NOT NULL,
  pms_entity TEXT NOT NULL,
  pms_field TEXT NOT NULL,
  transform_function TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.vet_pms_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_sync_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vet_lab_integrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.external_imaging_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pms_field_mappings ENABLE ROW LEVEL SECURITY;

-- RLS Policies for vet_pms_integrations
CREATE POLICY "Vets can manage their own PMS integrations"
ON public.vet_pms_integrations FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()))
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- RLS Policies for pms_sync_logs
CREATE POLICY "Vets can view their sync logs"
ON public.pms_sync_logs FOR SELECT
USING (integration_id IN (
  SELECT id FROM public.vet_pms_integrations 
  WHERE vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
));

-- RLS Policies for vet_lab_integrations
CREATE POLICY "Vets can manage their own lab integrations"
ON public.vet_lab_integrations FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()))
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- RLS Policies for external_lab_results
CREATE POLICY "Vets can manage external lab results"
ON public.external_lab_results FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()))
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- Pet owners can view their pets' external lab results
CREATE POLICY "Owners can view their pets external lab results"
ON public.external_lab_results FOR SELECT
USING (pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid()));

-- RLS Policies for external_imaging_results
CREATE POLICY "Vets can manage external imaging results"
ON public.external_imaging_results FOR ALL
USING (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()))
WITH CHECK (vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid()));

-- Pet owners can view their pets' external imaging
CREATE POLICY "Owners can view their pets external imaging"
ON public.external_imaging_results FOR SELECT
USING (pet_id IN (SELECT id FROM public.pet_profiles WHERE user_id = auth.uid()));

-- RLS Policies for pms_field_mappings
CREATE POLICY "Vets can manage their field mappings"
ON public.pms_field_mappings FOR ALL
USING (integration_id IN (
  SELECT id FROM public.vet_pms_integrations 
  WHERE vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
))
WITH CHECK (integration_id IN (
  SELECT id FROM public.vet_pms_integrations 
  WHERE vet_id IN (SELECT id FROM public.partner_vets WHERE user_id = auth.uid())
));

-- Indexes for performance
CREATE INDEX idx_pms_integrations_vet ON public.vet_pms_integrations(vet_id);
CREATE INDEX idx_pms_sync_logs_integration ON public.pms_sync_logs(integration_id);
CREATE INDEX idx_lab_integrations_vet ON public.vet_lab_integrations(vet_id);
CREATE INDEX idx_external_labs_vet ON public.external_lab_results(vet_id);
CREATE INDEX idx_external_labs_pet ON public.external_lab_results(pet_id);
CREATE INDEX idx_external_labs_date ON public.external_lab_results(result_date DESC);
CREATE INDEX idx_external_imaging_vet ON public.external_imaging_results(vet_id);
CREATE INDEX idx_external_imaging_pet ON public.external_imaging_results(pet_id);
CREATE INDEX idx_external_imaging_date ON public.external_imaging_results(study_date DESC);

-- Trigger for updated_at
CREATE TRIGGER update_vet_pms_integrations_updated_at
  BEFORE UPDATE ON public.vet_pms_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vet_lab_integrations_updated_at
  BEFORE UPDATE ON public.vet_lab_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_external_lab_results_updated_at
  BEFORE UPDATE ON public.external_lab_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_external_imaging_results_updated_at
  BEFORE UPDATE ON public.external_imaging_results
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();