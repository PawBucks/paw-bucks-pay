CREATE OR REPLACE FUNCTION public.set_pet_digital_id_token()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NEW.digital_id_token IS NULL THEN
    NEW.digital_id_token := encode(extensions.gen_random_bytes(18), 'hex');
  END IF;
  RETURN NEW;
END;
$$;