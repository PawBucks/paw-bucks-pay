ALTER TABLE public.merchant_pos_sales DROP CONSTRAINT IF EXISTS merchant_pos_sales_payment_method_check;
ALTER TABLE public.merchant_pos_sales ADD CONSTRAINT merchant_pos_sales_payment_method_check CHECK (payment_method IN ('cash','card_external','other','pawbucks_card'));
ALTER TABLE public.merchant_pos_sales ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'completed' CHECK (status IN ('awaiting_payment','completed','cancelled'));
ALTER TABLE public.merchant_pos_sales ADD COLUMN IF NOT EXISTS transaction_id uuid UNIQUE;
ALTER TABLE public.merchant_pos_sales ADD COLUMN IF NOT EXISTS paid_at timestamptz;

CREATE OR REPLACE FUNCTION public.complete_pos_sale(_merchant_id uuid, _items jsonb, _payment_method text, _discount numeric DEFAULT 0, _tax_rate numeric DEFAULT 0, _customer_name text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale_id uuid; _sub numeric := 0; _row jsonb; _item record; _qty int; _disc numeric; _tax numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = _merchant_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Ticket is empty'; END IF;
  IF _tax_rate < 0 OR _tax_rate > 25 THEN RAISE EXCEPTION 'Invalid tax rate'; END IF;
  INSERT INTO merchant_pos_sales(merchant_id, created_by, subtotal, discount, tax_rate, tax, total, payment_method, customer_name, note, status, paid_at)
  VALUES (_merchant_id, auth.uid(), 0, 0, _tax_rate, 0, 0, _payment_method, left(_customer_name,200), left(_note,1000),
    CASE WHEN _payment_method = 'pawbucks_card' THEN 'awaiting_payment' ELSE 'completed' END,
    CASE WHEN _payment_method = 'pawbucks_card' THEN NULL ELSE now() END)
  RETURNING id INTO _sale_id;
  FOR _row IN SELECT * FROM jsonb_array_elements(_items) LOOP
    _qty := (_row->>'quantity')::int;
    IF _qty IS NULL OR _qty < 1 OR _qty > 9999 THEN RAISE EXCEPTION 'Invalid quantity'; END IF;
    SELECT * INTO _item FROM merchant_pos_items WHERE id = (_row->>'item_id')::uuid AND merchant_id = _merchant_id AND is_active;
    IF NOT FOUND THEN RAISE EXCEPTION 'Item not found'; END IF;
    INSERT INTO merchant_pos_sale_items(sale_id, item_id, name, unit_price, quantity, line_total)
    VALUES (_sale_id, _item.id, _item.name, _item.price, _qty, round(_item.price * _qty, 2));
    _sub := _sub + round(_item.price * _qty, 2);
    IF _item.stock_quantity IS NOT NULL THEN
      UPDATE merchant_pos_items SET stock_quantity = greatest(stock_quantity - _qty, 0), updated_at = now() WHERE id = _item.id;
    END IF;
  END LOOP;
  _disc := least(greatest(coalesce(_discount,0),0), _sub);
  _tax := round((_sub - _disc) * _tax_rate / 100, 2);
  UPDATE merchant_pos_sales SET subtotal = _sub, discount = _disc, tax = _tax, total = _sub - _disc + _tax WHERE id = _sale_id;
  IF _payment_method = 'pawbucks_card' AND (_sub - _disc + _tax) < 0.5 THEN RAISE EXCEPTION 'Card payments must be at least $0.50'; END IF;
  RETURN _sale_id;
END $$;

CREATE OR REPLACE FUNCTION public.check_pos_sale_payment(_sale_id uuid)
RETURNS text LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _tx uuid;
BEGIN
  SELECT s.* INTO _s FROM merchant_pos_sales s JOIN merchants m ON m.id = s.merchant_id WHERE s.id = _sale_id AND m.user_id = auth.uid() FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _s.status <> 'awaiting_payment' THEN RETURN _s.status; END IF;
  SELECT t.id INTO _tx FROM transactions t
  WHERE t.merchant_id = _s.merchant_id AND t.status = 'completed' AND t.created_at >= _s.created_at
    AND t.amount >= _s.total - 0.01 AND t.amount <= _s.total + 0.01
    AND NOT EXISTS (SELECT 1 FROM merchant_pos_sales x WHERE x.transaction_id = t.id)
  ORDER BY t.created_at LIMIT 1;
  IF _tx IS NULL THEN RETURN 'awaiting_payment'; END IF;
  UPDATE merchant_pos_sales SET status = 'completed', transaction_id = _tx, paid_at = now() WHERE id = _sale_id;
  RETURN 'completed';
END $$;

CREATE OR REPLACE FUNCTION public.cancel_pos_sale(_sale_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record;
BEGIN
  SELECT s.* INTO _s FROM merchant_pos_sales s JOIN merchants m ON m.id = s.merchant_id WHERE s.id = _sale_id AND m.user_id = auth.uid() FOR UPDATE OF s;
  IF NOT FOUND THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF _s.status <> 'awaiting_payment' THEN RAISE EXCEPTION 'Only unpaid sales can be cancelled'; END IF;
  UPDATE merchant_pos_items i SET stock_quantity = i.stock_quantity + li.quantity, updated_at = now()
  FROM merchant_pos_sale_items li WHERE li.sale_id = _sale_id AND li.item_id = i.id AND i.stock_quantity IS NOT NULL;
  UPDATE merchant_pos_sales SET status = 'cancelled' WHERE id = _sale_id;
END $$;

REVOKE EXECUTE ON FUNCTION public.check_pos_sale_payment(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.cancel_pos_sale(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_pos_sale_payment(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_pos_sale(uuid) TO authenticated;