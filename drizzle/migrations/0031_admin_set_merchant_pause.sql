CREATE OR REPLACE FUNCTION public.admin_set_merchant_pause(_merchant_id uuid, _paused boolean, _reason text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;
  UPDATE public.merchants SET
    is_paused = _paused,
    paused_at = CASE WHEN _paused THEN now() ELSE NULL END,
    pause_reason = CASE WHEN _paused THEN NULLIF(left(_reason, 500), '') ELSE NULL END
  WHERE id = _merchant_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Merchant not found'; END IF;
END $$;
REVOKE ALL ON FUNCTION public.admin_set_merchant_pause(uuid, boolean, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_set_merchant_pause(uuid, boolean, text) TO authenticated, service_role;