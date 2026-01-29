-- Add new columns to pending_onboarding for steps 5-7
ALTER TABLE public.pending_onboarding
ADD COLUMN IF NOT EXISTS clinic_bio TEXT,
ADD COLUMN IF NOT EXISTS services_provided TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS accepting_new_patients BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_protocol TEXT,
ADD COLUMN IF NOT EXISTS stripe_account_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS agreed_to_tos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agreed_to_splicing_liability BOOLEAN DEFAULT false;

-- Add new columns to partner_vets for steps 5-7
ALTER TABLE public.partner_vets
ADD COLUMN IF NOT EXISTS clinic_bio TEXT,
ADD COLUMN IF NOT EXISTS services_provided TEXT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS accepting_new_patients BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS emergency_phone TEXT,
ADD COLUMN IF NOT EXISTS emergency_protocol TEXT,
ADD COLUMN IF NOT EXISTS stripe_connect_account_id TEXT,
ADD COLUMN IF NOT EXISTS subscription_tier TEXT DEFAULT 'standard',
ADD COLUMN IF NOT EXISTS agreed_to_tos BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agreed_to_tos_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS agreed_to_splicing_liability BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS agreed_to_splicing_liability_at TIMESTAMPTZ;