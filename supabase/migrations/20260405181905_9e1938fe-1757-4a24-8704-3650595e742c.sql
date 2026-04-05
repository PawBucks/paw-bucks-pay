
-- Create admin invoices table
CREATE TABLE public.admin_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_number TEXT NOT NULL,
  recipient_type TEXT NOT NULL CHECK (recipient_type IN ('merchant', 'vet')),
  recipient_id UUID NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_email TEXT,
  title TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void')),
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_rate NUMERIC(5,2) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_due NUMERIC(12,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  currency TEXT NOT NULL DEFAULT 'usd',
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL DEFAULT (CURRENT_DATE + INTERVAL '30 days')::date,
  paid_at TIMESTAMPTZ,
  notes TEXT,
  terms_conditions TEXT,
  invoice_type TEXT DEFAULT 'ad_hoc' CHECK (invoice_type IN ('platform_fee', 'subscription', 'ad_hoc', 'commission', 'onboarding')),
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create admin invoice items table
CREATE TABLE public.admin_invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.admin_invoices(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create admin invoice payments table
CREATE TABLE public.admin_invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.admin_invoices(id) ON DELETE CASCADE,
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL DEFAULT 'manual' CHECK (payment_method IN ('stripe', 'manual', 'check', 'ach', 'bank_transfer', 'other')),
  reference_number TEXT,
  stripe_payment_id TEXT,
  notes TEXT,
  recorded_by UUID NOT NULL,
  paid_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.admin_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_invoice_payments ENABLE ROW LEVEL SECURITY;

-- Admin-only policies for admin_invoices
CREATE POLICY "Admins can view all admin invoices" ON public.admin_invoices
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can create admin invoices" ON public.admin_invoices
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can update admin invoices" ON public.admin_invoices
  FOR UPDATE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

CREATE POLICY "Admins can delete admin invoices" ON public.admin_invoices
  FOR DELETE TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Admin-only policies for admin_invoice_items
CREATE POLICY "Admins can manage admin invoice items" ON public.admin_invoice_items
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Admin-only policies for admin_invoice_payments
CREATE POLICY "Admins can manage admin invoice payments" ON public.admin_invoice_payments
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'superadmin'))
  );

-- Trigger: update admin_invoices.updated_at
CREATE TRIGGER update_admin_invoices_updated_at
  BEFORE UPDATE ON public.admin_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function: update admin invoice totals when items change
CREATE OR REPLACE FUNCTION public.update_admin_invoice_totals()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_subtotal NUMERIC(12,2);
  v_invoice RECORD;
  v_discount NUMERIC(12,2);
  v_tax NUMERIC(12,2);
  v_total NUMERIC(12,2);
BEGIN
  SELECT * INTO v_invoice FROM admin_invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(quantity * unit_price), 0) INTO v_subtotal
  FROM admin_invoice_items WHERE invoice_id = v_invoice.id;

  v_discount := COALESCE(v_invoice.discount_amount, 0);
  v_tax := (v_subtotal - v_discount) * (COALESCE(v_invoice.tax_rate, 0) / 100);
  v_total := v_subtotal - v_discount + v_tax;

  UPDATE admin_invoices
  SET subtotal = v_subtotal, tax_amount = v_tax, total = v_total
  WHERE id = v_invoice.id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_admin_invoice_totals_on_item_change
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_invoice_totals();

-- Function: update admin invoice payment status
CREATE OR REPLACE FUNCTION public.update_admin_invoice_payment_status()
  RETURNS trigger
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_total_paid NUMERIC(12,2);
  v_invoice_total NUMERIC(12,2);
  v_new_status TEXT;
  v_inv_id UUID;
BEGIN
  v_inv_id := COALESCE(NEW.invoice_id, OLD.invoice_id);

  SELECT COALESCE(SUM(amount), 0) INTO v_total_paid
  FROM admin_invoice_payments WHERE invoice_id = v_inv_id;

  SELECT total, status INTO v_invoice_total, v_new_status
  FROM admin_invoices WHERE id = v_inv_id;

  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    SELECT status INTO v_new_status FROM admin_invoices WHERE id = v_inv_id;
    IF v_new_status IN ('paid', 'partially_paid') THEN
      v_new_status := 'sent';
    END IF;
  END IF;

  UPDATE admin_invoices
  SET amount_paid = v_total_paid,
      status = v_new_status,
      paid_at = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END
  WHERE id = v_inv_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER update_admin_invoice_payment_on_change
  AFTER INSERT OR UPDATE OR DELETE ON public.admin_invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_admin_invoice_payment_status();

-- Function: generate admin invoice number
CREATE OR REPLACE FUNCTION public.generate_admin_invoice_number()
  RETURNS TEXT
  LANGUAGE plpgsql
  SECURITY DEFINER
  SET search_path TO 'public'
AS $$
DECLARE
  v_next INTEGER;
  v_number TEXT;
BEGIN
  SELECT COALESCE(MAX(
    CASE WHEN invoice_number ~ '^ADM-[0-9]+$'
    THEN CAST(SUBSTRING(invoice_number FROM 5) AS INTEGER)
    ELSE 0 END
  ), 0) + 1 INTO v_next
  FROM admin_invoices;

  v_number := 'ADM-' || LPAD(v_next::TEXT, 5, '0');
  RETURN v_number;
END;
$$;

-- Index for fast lookups
CREATE INDEX idx_admin_invoices_recipient ON public.admin_invoices(recipient_type, recipient_id);
CREATE INDEX idx_admin_invoices_status ON public.admin_invoices(status);
CREATE INDEX idx_admin_invoice_items_invoice ON public.admin_invoice_items(invoice_id);
CREATE INDEX idx_admin_invoice_payments_invoice ON public.admin_invoice_payments(invoice_id);
