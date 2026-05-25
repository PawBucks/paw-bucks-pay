
CREATE OR REPLACE FUNCTION public.find_merchant_by_qr_token(p_token text)
RETURNS TABLE (
  id uuid,
  business_name text,
  latitude numeric,
  longitude numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT m.id, m.business_name, m.latitude, m.longitude
  FROM public.merchants m
  WHERE m.checkin_qr_token = p_token
    AND m.approval_status = 'approved'
    AND COALESCE(m.is_paused, false) = false
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.find_merchant_by_qr_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.find_merchant_by_qr_token(text) TO authenticated;
