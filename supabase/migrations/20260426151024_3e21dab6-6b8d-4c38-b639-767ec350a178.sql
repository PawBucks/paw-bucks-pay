-- Revoke share token (owner only)
CREATE OR REPLACE FUNCTION public.revoke_pet_digital_id_token(p_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM pet_profiles WHERE id = p_pet_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pet not found');
  END IF;
  IF v_owner <> v_user THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  UPDATE pet_profiles SET digital_id_token = NULL, updated_at = now() WHERE id = p_pet_id;
  RETURN jsonb_build_object('success', true);
END;
$$;

-- Regenerate share token (owner only)
CREATE OR REPLACE FUNCTION public.regenerate_pet_digital_id_token(p_pet_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_owner uuid;
  v_token text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT user_id INTO v_owner FROM pet_profiles WHERE id = p_pet_id;
  IF v_owner IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Pet not found');
  END IF;
  IF v_owner <> v_user THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  v_token := encode(gen_random_bytes(24), 'hex');
  UPDATE pet_profiles SET digital_id_token = v_token, updated_at = now() WHERE id = p_pet_id;
  RETURN jsonb_build_object('success', true, 'token', v_token);
END;
$$;

GRANT EXECUTE ON FUNCTION public.revoke_pet_digital_id_token(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.regenerate_pet_digital_id_token(uuid) TO authenticated;