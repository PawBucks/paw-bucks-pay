CREATE OR REPLACE FUNCTION public.verify_internal_trigger_secret(_provided text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = private, public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM private.system_config
    WHERE key = 'internal_trigger_secret'
      AND value = _provided
      AND _provided IS NOT NULL
      AND _provided <> ''
  );
$$;

REVOKE ALL ON FUNCTION public.verify_internal_trigger_secret(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_internal_trigger_secret(text) TO service_role;