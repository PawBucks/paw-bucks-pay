CREATE OR REPLACE FUNCTION public.update_invoice_totals()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_invoice_record RECORD;
  v_discount_amount NUMERIC(12,2);
  v_tax_amount NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  -- Get the invoice ID from the item
  SELECT * INTO v_invoice_record FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Calculate subtotal from all items
  SELECT COALESCE(SUM((quantity * unit_price) - COALESCE(discount_amount, 0)), 0)
  INTO v_subtotal
  FROM invoice_items
  WHERE invoice_id = v_invoice_record.id;
  
  -- Calculate discount
  IF v_invoice_record.discount_type = 'percentage' THEN
    v_discount_amount := v_subtotal * (COALESCE(v_invoice_record.discount_value, 0) / 100);
  ELSE
    v_discount_amount := COALESCE(v_invoice_record.discount_value, 0);
  END IF;
  
  -- Calculate tax
  v_tax_amount := (v_subtotal - v_discount_amount) * (COALESCE(v_invoice_record.tax_rate, 0) / 100);
  
  -- Calculate total
  v_total := v_subtotal - v_discount_amount + v_tax_amount + COALESCE(v_invoice_record.shipping_amount, 0);
  
  -- Update invoice WITHOUT setting amount_due (it's a generated column: total - amount_paid)
  UPDATE invoices
  SET 
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total = v_total
  WHERE id = v_invoice_record.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$function$;