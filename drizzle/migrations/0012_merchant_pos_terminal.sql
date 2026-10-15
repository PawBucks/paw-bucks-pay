CREATE TABLE public.merchant_pos_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 200),
  sku text,
  barcode text,
  category text,
  price numeric(10,2) NOT NULL DEFAULT 0 CHECK (price >= 0),
  stock_quantity integer,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX merchant_pos_items_barcode_uniq ON public.merchant_pos_items(merchant_id, barcode) WHERE barcode IS NOT NULL AND barcode <> '';
GRANT SELECT, INSERT, UPDATE, DELETE ON public.merchant_pos_items TO authenticated;
GRANT ALL ON public.merchant_pos_items TO service_role;
ALTER TABLE public.merchant_pos_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants manage own POS items" ON public.merchant_pos_items FOR ALL TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

CREATE TABLE public.merchant_pos_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  subtotal numeric(10,2) NOT NULL,
  discount numeric(10,2) NOT NULL DEFAULT 0,
  tax_rate numeric(6,3) NOT NULL DEFAULT 0,
  tax numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(10,2) NOT NULL,
  payment_method text NOT NULL CHECK (payment_method IN ('cash','card_external','other')),
  customer_name text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.merchant_pos_sales TO authenticated;
GRANT ALL ON public.merchant_pos_sales TO service_role;
ALTER TABLE public.merchant_pos_sales ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own POS sales" ON public.merchant_pos_sales FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid()));

CREATE TABLE public.merchant_pos_sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id uuid NOT NULL REFERENCES public.merchant_pos_sales(id) ON DELETE CASCADE,
  item_id uuid REFERENCES public.merchant_pos_items(id) ON DELETE SET NULL,
  name text NOT NULL,
  unit_price numeric(10,2) NOT NULL,
  quantity integer NOT NULL CHECK (quantity > 0),
  line_total numeric(10,2) NOT NULL
);
GRANT SELECT ON public.merchant_pos_sale_items TO authenticated;
GRANT ALL ON public.merchant_pos_sale_items TO service_role;
ALTER TABLE public.merchant_pos_sale_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Merchants view own POS sale items" ON public.merchant_pos_sale_items FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.merchant_pos_sales s JOIN public.merchants m ON m.id = s.merchant_id WHERE s.id = sale_id AND m.user_id = auth.uid()));

CREATE OR REPLACE FUNCTION public.complete_pos_sale(_merchant_id uuid, _items jsonb, _payment_method text, _discount numeric DEFAULT 0, _tax_rate numeric DEFAULT 0, _customer_name text DEFAULT NULL, _note text DEFAULT NULL)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _sale_id uuid; _sub numeric := 0; _row jsonb; _item record; _qty int; _disc numeric; _tax numeric;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = _merchant_id AND user_id = auth.uid()) THEN
    RAISE EXCEPTION 'Not allowed';
  END IF;
  IF jsonb_typeof(_items) <> 'array' OR jsonb_array_length(_items) = 0 THEN RAISE EXCEPTION 'Ticket is empty'; END IF;
  IF _tax_rate < 0 OR _tax_rate > 25 THEN RAISE EXCEPTION 'Invalid tax rate'; END IF;
  INSERT INTO merchant_pos_sales(merchant_id, created_by, subtotal, discount, tax_rate, tax, total, payment_method, customer_name, note)
  VALUES (_merchant_id, auth.uid(), 0, 0, _tax_rate, 0, 0, _payment_method, left(_customer_name,200), left(_note,1000))
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
  RETURN _sale_id;
END $$;
REVOKE EXECUTE ON FUNCTION public.complete_pos_sale(uuid, jsonb, text, numeric, numeric, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_pos_sale(uuid, jsonb, text, numeric, numeric, text, text) TO authenticated;