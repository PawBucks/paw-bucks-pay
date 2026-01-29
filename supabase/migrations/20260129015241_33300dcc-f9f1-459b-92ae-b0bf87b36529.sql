-- Create pending_onboarding table for draft saves
CREATE TABLE public.pending_onboarding (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  onboarding_type TEXT NOT NULL DEFAULT 'vet',
  current_step INTEGER NOT NULL DEFAULT 1,
  
  -- Step 1: Practice Identity
  legal_practice_name TEXT,
  dba_name TEXT,
  primary_phone TEXT,
  sms_capability BOOLEAN DEFAULT false,
  physical_address TEXT,
  city TEXT,
  state TEXT,
  zip_code TEXT,
  website_url TEXT,
  tax_id_ein TEXT,
  
  -- Step 2: Medical Verification
  medical_director_name TEXT,
  dvm_license_number TEXT,
  dvm_license_state TEXT,
  npi_number TEXT,
  practice_type TEXT,
  accreditations TEXT[] DEFAULT '{}',
  
  -- Step 3: Insurance Setup
  insurance_partners TEXT[] DEFAULT '{}',
  direct_pay_capability BOOLEAN DEFAULT false,
  splicing_preference TEXT,
  admin_splicing_fee NUMERIC(10,2),
  
  -- Step 4: Integration
  pims_software TEXT,
  data_sync_permission BOOLEAN DEFAULT false,
  preferred_referral_partners TEXT,
  
  -- Metadata
  form_data JSONB DEFAULT '{}',
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pending_onboarding ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own pending onboarding"
ON public.pending_onboarding FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own pending onboarding"
ON public.pending_onboarding FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own pending onboarding"
ON public.pending_onboarding FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own pending onboarding"
ON public.pending_onboarding FOR DELETE
USING (auth.uid() = user_id);

-- Trigger for updated_at
CREATE TRIGGER update_pending_onboarding_updated_at
BEFORE UPDATE ON public.pending_onboarding
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();