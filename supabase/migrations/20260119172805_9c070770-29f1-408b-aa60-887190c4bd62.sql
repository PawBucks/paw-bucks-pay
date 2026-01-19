-- =============================================
-- COMPREHENSIVE INVOICING SYSTEM SCHEMA
-- =============================================

-- Invoice Clients Table (for managing client contacts)
CREATE TABLE public.invoice_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  company_name TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  postal_code TEXT,
  country TEXT DEFAULT 'US',
  tax_id TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoice Settings Table (per-merchant customization)
CREATE TABLE public.invoice_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL UNIQUE REFERENCES public.merchants(id) ON DELETE CASCADE,
  -- Numbering
  invoice_prefix TEXT DEFAULT 'INV-',
  next_invoice_number INTEGER DEFAULT 1001,
  -- Default terms
  default_payment_terms INTEGER DEFAULT 30, -- days
  default_tax_rate NUMERIC(5,3) DEFAULT 0,
  default_notes TEXT,
  default_footer TEXT,
  -- Late fees
  late_fee_enabled BOOLEAN DEFAULT false,
  late_fee_type TEXT DEFAULT 'percentage', -- 'percentage' or 'flat'
  late_fee_amount NUMERIC(10,2) DEFAULT 0,
  late_fee_grace_days INTEGER DEFAULT 0,
  -- Reminders
  reminder_enabled BOOLEAN DEFAULT true,
  reminder_days_before INTEGER[] DEFAULT ARRAY[7, 3, 1],
  overdue_reminder_days INTEGER[] DEFAULT ARRAY[1, 7, 14, 30],
  -- Branding
  logo_url TEXT,
  accent_color TEXT DEFAULT '#3b82f6',
  -- Bank/Payment info for display
  bank_name TEXT,
  bank_account_name TEXT,
  bank_routing_number TEXT,
  bank_account_number_last4 TEXT,
  paypal_email TEXT,
  venmo_handle TEXT,
  -- Currency
  default_currency TEXT DEFAULT 'USD',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Main Invoices Table
CREATE TABLE public.invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  client_id UUID REFERENCES public.invoice_clients(id) ON DELETE SET NULL,
  -- Invoice identification
  invoice_number TEXT NOT NULL,
  -- Status: draft, sent, viewed, partially_paid, paid, overdue, cancelled, refunded
  status TEXT NOT NULL DEFAULT 'draft',
  -- Dates
  issue_date DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date DATE NOT NULL,
  sent_at TIMESTAMP WITH TIME ZONE,
  viewed_at TIMESTAMP WITH TIME ZONE,
  paid_at TIMESTAMP WITH TIME ZONE,
  -- Client snapshot (in case client is deleted or changed)
  client_name TEXT NOT NULL,
  client_email TEXT NOT NULL,
  client_phone TEXT,
  client_company TEXT,
  client_address TEXT,
  -- Amounts
  subtotal NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_type TEXT, -- 'percentage' or 'flat'
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  tax_rate NUMERIC(5,3) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  shipping_amount NUMERIC(12,2) DEFAULT 0,
  total NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_paid NUMERIC(12,2) DEFAULT 0,
  amount_due NUMERIC(12,2) GENERATED ALWAYS AS (total - amount_paid) STORED,
  -- Currency
  currency TEXT DEFAULT 'USD',
  -- Content
  title TEXT,
  notes TEXT,
  footer TEXT,
  terms_conditions TEXT,
  -- Payment
  payment_terms INTEGER DEFAULT 30,
  allow_partial_payments BOOLEAN DEFAULT true,
  allow_tips BOOLEAN DEFAULT false,
  accept_credit_card BOOLEAN DEFAULT true,
  accept_bank_transfer BOOLEAN DEFAULT false,
  accept_pawbucks BOOLEAN DEFAULT false,
  -- Access
  access_token TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  view_count INTEGER DEFAULT 0,
  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,
  -- Recurring
  is_recurring BOOLEAN DEFAULT false,
  recurring_interval TEXT, -- 'weekly', 'biweekly', 'monthly', 'quarterly', 'yearly'
  recurring_end_date DATE,
  parent_invoice_id UUID REFERENCES public.invoices(id),
  next_invoice_date DATE,
  -- Attachments
  attachment_urls TEXT[],
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Unique constraint on merchant + invoice number
  UNIQUE(merchant_id, invoice_number)
);

-- Invoice Line Items Table
CREATE TABLE public.invoice_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- Item details
  description TEXT NOT NULL,
  quantity NUMERIC(10,3) NOT NULL DEFAULT 1,
  unit_price NUMERIC(12,2) NOT NULL,
  unit_type TEXT DEFAULT 'unit', -- 'unit', 'hour', 'day', 'week', 'month', 'project'
  -- Discount at item level
  discount_type TEXT, -- 'percentage' or 'flat'
  discount_value NUMERIC(10,2) DEFAULT 0,
  discount_amount NUMERIC(12,2) DEFAULT 0,
  -- Tax
  tax_rate NUMERIC(5,3) DEFAULT 0,
  tax_amount NUMERIC(12,2) DEFAULT 0,
  -- Calculated
  subtotal NUMERIC(12,2) GENERATED ALWAYS AS (quantity * unit_price) STORED,
  total NUMERIC(12,2) GENERATED ALWAYS AS ((quantity * unit_price) - COALESCE(discount_amount, 0) + COALESCE(tax_amount, 0)) STORED,
  -- Ordering
  sort_order INTEGER DEFAULT 0,
  -- Service/product reference (optional)
  service_id UUID REFERENCES public.merchant_services(id) ON DELETE SET NULL,
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoice Payments Table
CREATE TABLE public.invoice_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  -- Payment details
  amount NUMERIC(12,2) NOT NULL,
  payment_method TEXT NOT NULL, -- 'credit_card', 'bank_transfer', 'pawbucks', 'cash', 'check', 'other'
  payment_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  -- Stripe references
  stripe_payment_intent_id TEXT,
  stripe_charge_id TEXT,
  -- Status
  status TEXT NOT NULL DEFAULT 'completed', -- 'pending', 'completed', 'failed', 'refunded'
  -- Notes
  notes TEXT,
  reference_number TEXT,
  -- Fees
  processing_fee NUMERIC(10,2) DEFAULT 0,
  -- Metadata
  recorded_by UUID, -- merchant user who recorded manual payment
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoice Activity Log
CREATE TABLE public.invoice_activity (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  action TEXT NOT NULL, -- 'created', 'sent', 'viewed', 'payment_received', 'reminder_sent', 'edited', 'cancelled'
  description TEXT,
  metadata JSONB,
  performed_by TEXT, -- 'merchant', 'client', 'system'
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Invoice Templates Table (for saving reusable invoice templates)
CREATE TABLE public.invoice_templates (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  -- Template content
  title TEXT,
  notes TEXT,
  footer TEXT,
  terms_conditions TEXT,
  -- Default items
  default_items JSONB, -- Array of item templates
  -- Settings
  payment_terms INTEGER DEFAULT 30,
  tax_rate NUMERIC(5,3) DEFAULT 0,
  discount_type TEXT,
  discount_value NUMERIC(10,2),
  allow_partial_payments BOOLEAN DEFAULT true,
  -- Metadata
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- =============================================
-- INDEXES
-- =============================================

CREATE INDEX idx_invoice_clients_merchant ON public.invoice_clients(merchant_id);
CREATE INDEX idx_invoice_clients_email ON public.invoice_clients(merchant_id, email);
CREATE INDEX idx_invoices_merchant ON public.invoices(merchant_id);
CREATE INDEX idx_invoices_client ON public.invoices(client_id);
CREATE INDEX idx_invoices_status ON public.invoices(merchant_id, status);
CREATE INDEX idx_invoices_due_date ON public.invoices(due_date);
CREATE INDEX idx_invoices_access_token ON public.invoices(access_token);
CREATE INDEX idx_invoices_recurring ON public.invoices(is_recurring, next_invoice_date) WHERE is_recurring = true;
CREATE INDEX idx_invoice_items_invoice ON public.invoice_items(invoice_id);
CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
CREATE INDEX idx_invoice_activity_invoice ON public.invoice_activity(invoice_id);
CREATE INDEX idx_invoice_templates_merchant ON public.invoice_templates(merchant_id);

-- =============================================
-- RLS POLICIES
-- =============================================

-- Enable RLS on all tables
ALTER TABLE public.invoice_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_templates ENABLE ROW LEVEL SECURITY;

-- Invoice Clients Policies
CREATE POLICY "Merchants can view their own clients"
  ON public.invoice_clients FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own clients"
  ON public.invoice_clients FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own clients"
  ON public.invoice_clients FOR UPDATE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their own clients"
  ON public.invoice_clients FOR DELETE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Invoice Settings Policies
CREATE POLICY "Merchants can view their own settings"
  ON public.invoice_settings FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own settings"
  ON public.invoice_settings FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own settings"
  ON public.invoice_settings FOR UPDATE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Invoices Policies
CREATE POLICY "Merchants can view their own invoices"
  ON public.invoices FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own invoices"
  ON public.invoices FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own invoices"
  ON public.invoices FOR UPDATE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their own invoices"
  ON public.invoices FOR DELETE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- Invoice Items Policies (via invoice ownership)
CREATE POLICY "Merchants can view items of their invoices"
  ON public.invoice_items FOR SELECT
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can insert items to their invoices"
  ON public.invoice_items FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can update items of their invoices"
  ON public.invoice_items FOR UPDATE
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can delete items from their invoices"
  ON public.invoice_items FOR DELETE
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

-- Invoice Payments Policies
CREATE POLICY "Merchants can view payments of their invoices"
  ON public.invoice_payments FOR SELECT
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can insert payments to their invoices"
  ON public.invoice_payments FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can update payments of their invoices"
  ON public.invoice_payments FOR UPDATE
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

-- Invoice Activity Policies
CREATE POLICY "Merchants can view activity of their invoices"
  ON public.invoice_activity FOR SELECT
  USING (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

CREATE POLICY "Merchants can insert activity to their invoices"
  ON public.invoice_activity FOR INSERT
  WITH CHECK (invoice_id IN (SELECT id FROM public.invoices WHERE merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())));

-- Invoice Templates Policies
CREATE POLICY "Merchants can view their own templates"
  ON public.invoice_templates FOR SELECT
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can insert their own templates"
  ON public.invoice_templates FOR INSERT
  WITH CHECK (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can update their own templates"
  ON public.invoice_templates FOR UPDATE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Merchants can delete their own templates"
  ON public.invoice_templates FOR DELETE
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

-- =============================================
-- TRIGGERS
-- =============================================

-- Update timestamps trigger
CREATE TRIGGER update_invoice_clients_updated_at
  BEFORE UPDATE ON public.invoice_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_settings_updated_at
  BEFORE UPDATE ON public.invoice_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoices_updated_at
  BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_items_updated_at
  BEFORE UPDATE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_payments_updated_at
  BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_invoice_templates_updated_at
  BEFORE UPDATE ON public.invoice_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =============================================
-- FUNCTIONS
-- =============================================

-- Function to generate next invoice number
CREATE OR REPLACE FUNCTION public.generate_invoice_number(p_merchant_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_prefix TEXT;
  v_next_number INTEGER;
  v_invoice_number TEXT;
BEGIN
  -- Get or create settings
  INSERT INTO invoice_settings (merchant_id)
  VALUES (p_merchant_id)
  ON CONFLICT (merchant_id) DO NOTHING;
  
  -- Get and increment the next number
  UPDATE invoice_settings
  SET next_invoice_number = next_invoice_number + 1
  WHERE merchant_id = p_merchant_id
  RETURNING invoice_prefix, next_invoice_number - 1 INTO v_prefix, v_next_number;
  
  v_invoice_number := v_prefix || LPAD(v_next_number::TEXT, 5, '0');
  
  RETURN v_invoice_number;
END;
$$;

-- Function to update invoice totals
CREATE OR REPLACE FUNCTION public.update_invoice_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
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
  
  -- Update invoice
  UPDATE invoices
  SET 
    subtotal = v_subtotal,
    discount_amount = v_discount_amount,
    tax_amount = v_tax_amount,
    total = v_total
  WHERE id = v_invoice_record.id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_invoice_totals
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_items
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_totals();

-- Function to update invoice payment status
CREATE OR REPLACE FUNCTION public.update_invoice_payment_status()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_total_paid NUMERIC(12,2);
  v_invoice_total NUMERIC(12,2);
  v_new_status TEXT;
BEGIN
  -- Calculate total paid
  SELECT COALESCE(SUM(amount), 0)
  INTO v_total_paid
  FROM invoice_payments
  WHERE invoice_id = COALESCE(NEW.invoice_id, OLD.invoice_id)
  AND status = 'completed';
  
  -- Get invoice total
  SELECT total INTO v_invoice_total
  FROM invoices
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  -- Determine new status
  IF v_total_paid >= v_invoice_total THEN
    v_new_status := 'paid';
  ELSIF v_total_paid > 0 THEN
    v_new_status := 'partially_paid';
  ELSE
    -- Keep existing status if no payments (could be sent, viewed, overdue, etc.)
    SELECT status INTO v_new_status FROM invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
    -- But if it was paid and payment was removed, set to sent
    IF v_new_status IN ('paid', 'partially_paid') THEN
      v_new_status := 'sent';
    END IF;
  END IF;
  
  -- Update invoice
  UPDATE invoices
  SET 
    amount_paid = v_total_paid,
    status = v_new_status,
    paid_at = CASE WHEN v_new_status = 'paid' THEN now() ELSE paid_at END
  WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trigger_update_invoice_payment_status
  AFTER INSERT OR UPDATE OR DELETE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_invoice_payment_status();

-- Enable realtime for invoices
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoices;
ALTER PUBLICATION supabase_realtime ADD TABLE public.invoice_payments;