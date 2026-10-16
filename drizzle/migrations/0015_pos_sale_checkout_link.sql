ALTER TABLE public.merchant_pos_sales ADD COLUMN IF NOT EXISTS stripe_payment_intent_id text;

CREATE OR REPLACE FUNCTION public.get_pos_sale_for_checkout(_sale_id uuid)
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT jsonb_build_object(
    'id', s.id, 'merchant_id', s.merchant_id, 'subtotal', s.subtotal, 'discount', s.discount,
    'tax', s.tax, 'tip', s.tip, 'total', s.total, 'status', s.status,
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object('name', li.name, 'quantity', li.quantity, 'unit_price', li.unit_price))
                       FROM merchant_pos_sale_items li WHERE li.sale_id = s.id), '[]'::jsonb))
  FROM merchant_pos_sales s WHERE s.id = _sale_id AND s.status = 'awaiting_payment';
$$;
REVOKE EXECUTE ON FUNCTION public.get_pos_sale_for_checkout(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_pos_sale_for_checkout(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.check_pos_sale_payment(_sale_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _tx uuid;
BEGIN
  SELECT s.* INTO _s FROM merchant_pos_sales s JOIN merchants m ON m.id = s.merchant_id WHERE s.id = _sale_id AND m.user_id = auth.uid() FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _s.status <> 'awaiting_payment' THEN RETURN _s.status; END IF;
  IF _s.stripe_payment_intent_id IS NULL THEN RETURN 'awaiting_payment'; END IF;
  SELECT t.id INTO _tx FROM transactions t
  WHERE t.stripe_payment_intent_id = _s.stripe_payment_intent_id AND t.status = 'completed'
  ORDER BY t.created_at LIMIT 1;
  IF _tx IS NULL THEN RETURN 'awaiting_payment'; END IF;
  UPDATE merchant_pos_sales SET status = 'completed', transaction_id = _tx, paid_at = now() WHERE id = _sale_id;
  RETURN 'completed';
END $$;