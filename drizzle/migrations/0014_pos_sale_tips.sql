ALTER TABLE public.merchant_pos_sales ADD COLUMN IF NOT EXISTS tip numeric NOT NULL DEFAULT 0;
DROP FUNCTION IF EXISTS public.complete_pos_sale(uuid, jsonb, text, numeric, numeric, text, text);
CREATE OR REPLACE FUNCTION public.complete_pos_sale(_merchant_id uuid, _items jsonb, _payment_method text, _discount numeric DEFAULT 0, _tax_rate numeric DEFAULT 0, _customer_name text DEFAULT NULL::text, _note text DEFAULT NULL::text, _tip numeric DEFAULT 0)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _sale_id uuid; _sub numeric := 0; _row jsonb; _item record; _qty int; _disc numeric; _tax numeric; _t numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = _merchant_id AND user_id = auth.uid()) THEN RAISE EXCEPTION 'Not allowed'; END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Ticket is empty'; END IF;
  IF _tax_rate < 0 OR _tax_rate > 25 THEN RAISE EXCEPTION 'Invalid tax rate'; END IF;
  _t := round(coalesce(_tip,0), 2);
  IF _t < 0 OR _t > 10000 THEN RAISE EXCEPTION 'Invalid tip'; END IF;
  INSERT INTO merchant_pos_sales(merchant_id, created_by, subtotal, discount, tax_rate, tax, total, tip, payment_method, customer_name, note, status, paid_at)
  VALUES (_merchant_id, auth.uid(), 0, 0, _tax_rate, 0, 0, _t, _payment_method, left(_customer_name,200), left(_note,1000),
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
  UPDATE merchant_pos_sales SET subtotal = _sub, discount = _disc, tax = _tax, total = _sub - _disc + _tax + _t WHERE id = _sale_id;
  IF _payment_method = 'pawbucks_card' AND (_sub - _disc + _tax + _t) < 0.5 THEN RAISE EXCEPTION 'Card payments must be at least $0.50'; END IF;
  RETURN _sale_id;
END $function$;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(uuid, jsonb, text, numeric, numeric, text, text, numeric) TO authenticated;