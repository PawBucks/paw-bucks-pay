
CREATE UNIQUE INDEX IF NOT EXISTS invoices_merchant_invoice_number_uniq
  ON public.invoices (merchant_id, invoice_number);

CREATE OR REPLACE FUNCTION public.assign_invoice_number()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_prefix TEXT; v_next INTEGER;
BEGIN
  IF NEW.invoice_number IS NOT NULL AND length(trim(NEW.invoice_number)) > 0 THEN RETURN NEW; END IF;
  INSERT INTO public.invoice_settings (merchant_id) VALUES (NEW.merchant_id) ON CONFLICT (merchant_id) DO NOTHING;
  UPDATE public.invoice_settings SET next_invoice_number = next_invoice_number + 1
   WHERE merchant_id = NEW.merchant_id
  RETURNING invoice_prefix, next_invoice_number - 1 INTO v_prefix, v_next;
  NEW.invoice_number := COALESCE(v_prefix, 'INV-') || LPAD(v_next::TEXT, 5, '0');
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_assign_invoice_number ON public.invoices;
CREATE TRIGGER trg_assign_invoice_number BEFORE INSERT ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.assign_invoice_number();

CREATE OR REPLACE FUNCTION public.protect_paid_invoice_delete()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v_tx_count INT; v_pay_count INT;
BEGIN
  IF COALESCE(OLD.amount_paid, 0) > 0 THEN
    RAISE EXCEPTION 'Cannot delete invoice % – it has payments applied ($%). Void or refund first.', OLD.invoice_number, OLD.amount_paid;
  END IF;
  SELECT COUNT(*) INTO v_pay_count FROM public.invoice_payments WHERE invoice_id = OLD.id;
  IF v_pay_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete invoice % – % payment record(s) reference it.', OLD.invoice_number, v_pay_count;
  END IF;
  SELECT COUNT(*) INTO v_tx_count FROM public.transactions
   WHERE merchant_id = OLD.merchant_id AND description ILIKE '%' || OLD.invoice_number || '%';
  IF v_tx_count > 0 THEN
    RAISE EXCEPTION 'Cannot delete invoice % – % transaction(s) reference it.', OLD.invoice_number, v_tx_count;
  END IF;
  RETURN OLD;
END; $$;

DROP TRIGGER IF EXISTS trg_protect_paid_invoice_delete ON public.invoices;
CREATE TRIGGER trg_protect_paid_invoice_delete BEFORE DELETE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.protect_paid_invoice_delete();

CREATE OR REPLACE FUNCTION public.admin_reconciliation_report()
RETURNS TABLE (
  kind TEXT, merchant_id UUID, business_name TEXT, detail TEXT,
  reference_id TEXT, amount NUMERIC, occurred_at TIMESTAMPTZ
) LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  RETURN QUERY
  WITH inv_refs AS (
    SELECT t.id, t.merchant_id, t.amount, t.created_at,
           (regexp_match(t.description, 'Invoice #([A-Za-z0-9\-_]+)'))[1] AS inv_num
      FROM public.transactions t
     WHERE t.description ~* 'Invoice #' AND t.status = 'completed'
  )
  SELECT 'orphan_invoice_transaction'::TEXT, r.merchant_id,
         COALESCE(m.business_name, '(unknown)'),
         'Transaction references missing invoice #' || r.inv_num,
         r.id::TEXT, r.amount, r.created_at
  FROM inv_refs r LEFT JOIN public.merchants m ON m.id = r.merchant_id
  WHERE r.inv_num IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM public.invoices i
       WHERE i.merchant_id = r.merchant_id AND i.invoice_number = r.inv_num
    );

  RETURN QUERY
  WITH parsed AS (
    SELECT i.merchant_id, i.invoice_number,
           NULLIF(regexp_replace(i.invoice_number, '\D', '', 'g'), '')::BIGINT AS n
      FROM public.invoices i
  ),
  ranges AS (
    SELECT merchant_id, MIN(n) AS min_n, MAX(n) AS max_n
      FROM parsed WHERE n IS NOT NULL GROUP BY merchant_id
     HAVING (MAX(n) - MIN(n)) < 10000
  ),
  series AS (
    SELECT r.merchant_id, gs AS n FROM ranges r,
           LATERAL generate_series(r.min_n, r.max_n) gs
  ),
  missing AS (
    SELECT s.merchant_id, s.n FROM series s
      LEFT JOIN parsed p ON p.merchant_id = s.merchant_id AND p.n = s.n
     WHERE p.n IS NULL
  )
  SELECT 'invoice_number_gap'::TEXT, mi.merchant_id,
         COALESCE(m.business_name, '(unknown)'),
         'Missing invoice number ' || mi.n::TEXT,
         mi.n::TEXT, NULL::NUMERIC, NULL::TIMESTAMPTZ
  FROM missing mi LEFT JOIN public.merchants m ON m.id = mi.merchant_id;

  RETURN QUERY
  SELECT 'paid_invoice_no_transaction'::TEXT, i.merchant_id,
         COALESCE(m.business_name, '(unknown)'),
         'Invoice ' || i.invoice_number || ' marked paid but no transaction recorded',
         i.id::TEXT, i.amount_paid, i.paid_at
  FROM public.invoices i LEFT JOIN public.merchants m ON m.id = i.merchant_id
  WHERE i.status = 'paid' AND COALESCE(i.amount_paid, 0) > 0
    AND NOT EXISTS (
      SELECT 1 FROM public.transactions t
       WHERE t.merchant_id = i.merchant_id
         AND t.description ILIKE '%' || i.invoice_number || '%'
    )
    AND NOT EXISTS (SELECT 1 FROM public.invoice_payments p WHERE p.invoice_id = i.id);
END; $$;

GRANT EXECUTE ON FUNCTION public.admin_reconciliation_report() TO authenticated;

-- Backfill IHD01104 (skip generated column amount_due)
DO $$
DECLARE
  v_merchant UUID := '4d7a445c-5b3f-4090-876e-eb482ab10243';
  v_tx RECORD; v_invoice_id UUID;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.invoices WHERE merchant_id = v_merchant AND invoice_number = 'IHD01104') THEN
    SELECT * INTO v_tx FROM public.transactions WHERE id = 'b7e87779-2014-4d26-93a8-8f7c278a70ac';
    INSERT INTO public.invoices (
      merchant_id, invoice_number, status, issue_date, due_date,
      client_name, client_email, subtotal, total, amount_paid, currency,
      title, notes, paid_at, created_at, updated_at
    )
    SELECT v_merchant, 'IHD01104', 'paid', v_tx.created_at::date, v_tx.created_at::date,
           COALESCE(p.full_name, 'Markus Gerdemann'),
           COALESCE(p.email, 'markus.gerdemann@gmail.com'),
           v_tx.amount, v_tx.amount, v_tx.amount, 'usd',
           'Backfilled from transaction',
           'Automatically restored from transaction ' || v_tx.id::text,
           v_tx.created_at, v_tx.created_at, now()
    FROM public.profiles p WHERE p.id = v_tx.user_id
    RETURNING id INTO v_invoice_id;

    INSERT INTO public.invoice_activity (invoice_id, action, description, metadata)
    VALUES (v_invoice_id, 'backfilled',
            'Invoice record reconstructed from existing transaction',
            jsonb_build_object('transaction_id', v_tx.id, 'source', 'admin_backfill_migration'));
  END IF;
END $$;
