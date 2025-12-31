-- Add expanded pet profile fields to match Lost Pet Flyer fields
ALTER TABLE public.pet_profiles
ADD COLUMN IF NOT EXISTS color_markings TEXT,
ADD COLUMN IF NOT EXISTS size TEXT,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS age_estimate TEXT,
ADD COLUMN IF NOT EXISTS microchip_number TEXT,
ADD COLUMN IF NOT EXISTS collar_description TEXT,
ADD COLUMN IF NOT EXISTS identifying_features TEXT;

-- Add comments for clarity
COMMENT ON COLUMN public.pet_profiles.color_markings IS 'Pet color and distinguishing markings';
COMMENT ON COLUMN public.pet_profiles.size IS 'Pet size: small, medium, or large';
COMMENT ON COLUMN public.pet_profiles.gender IS 'Pet gender: male, female, or unknown';
COMMENT ON COLUMN public.pet_profiles.age_estimate IS 'Estimated age description';
COMMENT ON COLUMN public.pet_profiles.microchip_number IS 'Microchip ID if registered';
COMMENT ON COLUMN public.pet_profiles.collar_description IS 'Description of collar and tags';
COMMENT ON COLUMN public.pet_profiles.identifying_features IS 'Unique identifying features like scars or markings';