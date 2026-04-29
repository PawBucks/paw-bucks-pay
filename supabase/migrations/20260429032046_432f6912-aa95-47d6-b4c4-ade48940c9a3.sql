CREATE OR REPLACE FUNCTION public.set_system_config(_key text, _value text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public
AS $$
BEGIN
  -- Only the service role may invoke this (anon/authenticated cannot reach it).
  INSERT INTO private.system_config (key, value, updated_at)
  VALUES (_key, _value, now())
  ON CONFLICT (key) DO UPDATE
    SET value = EXCLUDED.value, updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.set_system_config(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_system_config(text, text) TO service_role;