CREATE OR REPLACE FUNCTION public._verify_gaa() RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE result json;
BEGIN
  PERFORM set_config('request.jwt.claims', '{"role":"authenticated","sub":"0cf7673e-60a5-44ac-8905-f6e8a991dc50"}', true);
  BEGIN
    SELECT to_json(t) INTO result FROM public.get_admin_analytics() t;
  EXCEPTION WHEN OTHERS THEN
    result := json_build_object('err', SQLERRM, 'state', SQLSTATE);
  END;
  RETURN result;
END;$$;