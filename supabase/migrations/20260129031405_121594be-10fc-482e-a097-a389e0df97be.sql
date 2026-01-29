-- Create invoice slices table to track insurance vs owner portions
CREATE TABLE public.invoice_slices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id UUID REFERENCES public.invoices(id) ON DELETE CASCADE NOT NULL,
  claim_id UUID REFERENCES public.insurance_claims(id),
  slice_type TEXT NOT NULL CHECK (slice_type IN ('insurance', 'owner', 'pawbucks')),
  original_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  actual_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  gap_amount NUMERIC(12,2) GENERATED ALWAYS AS (original_amount - actual_amount) STORED,
  recovery_status TEXT DEFAULT 'pending' CHECK (recovery_status IN ('pending', 'notification_sent', 'option_selected', 'funded', 'written_off')),
  recovery_option TEXT CHECK (recovery_option IN ('pay_now', 'pawbucks', 'payment_plan', 'appeal')),
  notification_sent_at TIMESTAMPTZ,
  option_selected_at TIMESTAMPTZ,
  funded_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Create claim recovery log for audit trail
CREATE TABLE public.claim_recovery_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_id UUID REFERENCES public.invoice_slices(id) ON DELETE CASCADE NOT NULL,
  action TEXT NOT NULL,
  actor_type TEXT NOT NULL CHECK (actor_type IN ('vet', 'owner', 'system')),
  actor_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Create payment plans table
CREATE TABLE public.claim_payment_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slice_id UUID REFERENCES public.invoice_slices(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID NOT NULL,
  total_amount NUMERIC(12,2) NOT NULL,
  installments INTEGER NOT NULL DEFAULT 3,
  installment_amount NUMERIC(12,2) NOT NULL,
  paid_installments INTEGER DEFAULT 0,
  next_due_date DATE,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'defaulted', 'cancelled')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.invoice_slices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_recovery_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.claim_payment_plans ENABLE ROW LEVEL SECURITY;

-- RLS Policies for invoice_slices
CREATE POLICY "Vets can view slices for their claims"
ON public.invoice_slices FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.insurance_claims ic
    JOIN public.partner_vets pv ON pv.id = ic.vet_id
    WHERE ic.id = invoice_slices.claim_id
    AND pv.user_id = auth.uid()
  )
);

CREATE POLICY "Service role can manage slices"
ON public.invoice_slices FOR ALL
USING (true)
WITH CHECK (true);

-- RLS Policies for claim_recovery_log
CREATE POLICY "Vets can view recovery logs"
ON public.claim_recovery_log FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoice_slices isl
    JOIN public.insurance_claims ic ON ic.id = isl.claim_id
    JOIN public.partner_vets pv ON pv.id = ic.vet_id
    WHERE isl.id = claim_recovery_log.slice_id
    AND pv.user_id = auth.uid()
  )
);

-- RLS Policies for claim_payment_plans
CREATE POLICY "Owners can view their payment plans"
ON public.claim_payment_plans FOR SELECT
USING (owner_id = auth.uid());

CREATE POLICY "Vets can view payment plans for their slices"
ON public.claim_payment_plans FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.invoice_slices isl
    JOIN public.insurance_claims ic ON ic.id = isl.claim_id
    JOIN public.partner_vets pv ON pv.id = ic.vet_id
    WHERE isl.id = claim_payment_plans.slice_id
    AND pv.user_id = auth.uid()
  )
);

-- Add indexes
CREATE INDEX idx_invoice_slices_claim ON public.invoice_slices(claim_id);
CREATE INDEX idx_invoice_slices_invoice ON public.invoice_slices(invoice_id);
CREATE INDEX idx_invoice_slices_recovery_status ON public.invoice_slices(recovery_status);
CREATE INDEX idx_claim_recovery_log_slice ON public.claim_recovery_log(slice_id);
CREATE INDEX idx_claim_payment_plans_owner ON public.claim_payment_plans(owner_id);

-- Trigger for updated_at
CREATE TRIGGER update_invoice_slices_updated_at
  BEFORE UPDATE ON public.invoice_slices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_claim_payment_plans_updated_at
  BEFORE UPDATE ON public.claim_payment_plans
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();