
-- Add a public share token to pet_profiles for the Digital ID
ALTER TABLE public.pet_profiles
  ADD COLUMN IF NOT EXISTS digital_id_token text UNIQUE;

-- Backfill tokens for existing pets
UPDATE public.pet_profiles
SET digital_id_token = encode(gen_random_bytes(18), 'hex')
WHERE digital_id_token IS NULL;

-- Auto-generate token on insert
CREATE OR REPLACE FUNCTION public.set_pet_digital_id_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.digital_id_token IS NULL THEN
    NEW.digital_id_token := encode(gen_random_bytes(18), 'hex');
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_pet_digital_id_token ON public.pet_profiles;
CREATE TRIGGER trg_set_pet_digital_id_token
BEFORE INSERT ON public.pet_profiles
FOR EACH ROW EXECUTE FUNCTION public.set_pet_digital_id_token();

-- Public, read-only function: returns a safe Digital ID snapshot by token
CREATE OR REPLACE FUNCTION public.get_pet_digital_id(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_pet record;
  v_owner record;
  v_vaccinations jsonb;
  v_allergies jsonb;
BEGIN
  IF p_token IS NULL OR length(p_token) < 16 THEN
    RETURN NULL;
  END IF;

  SELECT id, user_id, name, type, breed, birthday, photo_url, gender,
         color_markings, size, microchip_number, identifying_features
    INTO v_pet
  FROM public.pet_profiles
  WHERE digital_id_token = p_token;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT full_name INTO v_owner
  FROM public.profiles
  WHERE id = v_pet.user_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'vaccine_name', vaccine_name,
    'vaccine_type', vaccine_type,
    'manufacturer', manufacturer,
    'lot_number', lot_number,
    'administration_date', administration_date,
    'expiration_date', expiration_date,
    'next_due_date', next_due_date,
    'administered_by', administered_by,
    'certificate_url', certificate_url
  ) ORDER BY administration_date DESC), '[]'::jsonb) INTO v_vaccinations
  FROM public.pet_vaccinations
  WHERE pet_id = v_pet.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'allergy_name', allergy_name,
    'allergy_type', allergy_type,
    'severity', severity
  )), '[]'::jsonb) INTO v_allergies
  FROM public.pet_allergies
  WHERE pet_id = v_pet.id AND is_active = true;

  RETURN jsonb_build_object(
    'pet', jsonb_build_object(
      'id', v_pet.id,
      'name', v_pet.name,
      'type', v_pet.type,
      'breed', v_pet.breed,
      'birthday', v_pet.birthday,
      'photo_url', v_pet.photo_url,
      'gender', v_pet.gender,
      'color_markings', v_pet.color_markings,
      'size', v_pet.size,
      'microchip_number', v_pet.microchip_number,
      'identifying_features', v_pet.identifying_features
    ),
    'owner', jsonb_build_object(
      'full_name', COALESCE(v_owner.full_name, 'PawBucks Member')
    ),
    'vaccinations', v_vaccinations,
    'allergies', v_allergies,
    'verified_at', now()
  );
END;
$$;

-- Allow anonymous and authenticated users to call the verification function
GRANT EXECUTE ON FUNCTION public.get_pet_digital_id(text) TO anon, authenticated;
