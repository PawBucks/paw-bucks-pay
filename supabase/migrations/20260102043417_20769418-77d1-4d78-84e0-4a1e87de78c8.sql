-- Create table for pet health record access codes
CREATE TABLE public.pet_health_access_codes (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    pet_id uuid NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
    owner_id uuid NOT NULL,
    vet_name text NOT NULL,
    vet_email text,
    vet_clinic text,
    access_code text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT true,
    expires_at timestamp with time zone,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    last_accessed_at timestamp with time zone
);

-- Enable RLS
ALTER TABLE public.pet_health_access_codes ENABLE ROW LEVEL SECURITY;

-- Pet owners can manage their own access codes
CREATE POLICY "Owners can view their access codes"
ON public.pet_health_access_codes
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can create access codes"
ON public.pet_health_access_codes
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners can update their access codes"
ON public.pet_health_access_codes
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Owners can delete their access codes"
ON public.pet_health_access_codes
FOR DELETE
USING (auth.uid() = owner_id);

-- Create index for fast lookups by access code
CREATE INDEX idx_pet_health_access_codes_code ON public.pet_health_access_codes(access_code);
CREATE INDEX idx_pet_health_access_codes_pet ON public.pet_health_access_codes(pet_id);