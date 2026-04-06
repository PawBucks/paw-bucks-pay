
-- Add new columns to receipt_submissions
ALTER TABLE public.receipt_submissions 
  ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id),
  ADD COLUMN IF NOT EXISTS submission_type text NOT NULL DEFAULT 'non_partner',
  ADD COLUMN IF NOT EXISTS credit_rate_percent numeric(5,2),
  ADD COLUMN IF NOT EXISTS subscription_tier text,
  ADD COLUMN IF NOT EXISTS confirmation_id uuid;

-- Create index for merchant_id lookups
CREATE INDEX IF NOT EXISTS idx_receipt_submissions_merchant_id ON public.receipt_submissions(merchant_id);
CREATE INDEX IF NOT EXISTS idx_receipt_submissions_submission_type ON public.receipt_submissions(submission_type);

-- Create merchant_sale_confirmations table
CREATE TABLE IF NOT EXISTS public.merchant_sale_confirmations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id uuid NOT NULL REFERENCES public.merchants(id),
  customer_email text NOT NULL,
  customer_name text,
  amount numeric(12,2) NOT NULL,
  confirmation_code text NOT NULL DEFAULT upper(substr(md5(random()::text), 1, 8)),
  status text NOT NULL DEFAULT 'pending',
  receipt_submission_id uuid REFERENCES public.receipt_submissions(id),
  notes text,
  confirmed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.merchant_sale_confirmations ENABLE ROW LEVEL SECURITY;

-- Merchant can view their own confirmations
CREATE POLICY "Merchants can view own confirmations"
  ON public.merchant_sale_confirmations FOR SELECT
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_superadmin(auth.uid())
  );

-- Merchants can create confirmations for their business
CREATE POLICY "Merchants can create confirmations"
  ON public.merchant_sale_confirmations FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
  );

-- Merchants can update their own confirmations
CREATE POLICY "Merchants can update own confirmations"
  ON public.merchant_sale_confirmations FOR UPDATE
  TO authenticated
  USING (
    EXISTS (SELECT 1 FROM merchants m WHERE m.id = merchant_id AND m.user_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_superadmin(auth.uid())
  );

-- Admins can manage all confirmations
CREATE POLICY "Admins can manage all confirmations"
  ON public.merchant_sale_confirmations FOR ALL
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid())
  );

-- Add FK from receipt_submissions.confirmation_id
ALTER TABLE public.receipt_submissions
  ADD CONSTRAINT receipt_submissions_confirmation_id_fkey
  FOREIGN KEY (confirmation_id) REFERENCES public.merchant_sale_confirmations(id);

-- Update RLS on receipt_submissions: allow all authenticated users to insert (not just PawPass+)
DROP POLICY IF EXISTS "Users can submit receipts" ON public.receipt_submissions;
CREATE POLICY "Users can submit receipts"
  ON public.receipt_submissions FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can view own receipts" ON public.receipt_submissions;
CREATE POLICY "Users can view own receipts"
  ON public.receipt_submissions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

DROP POLICY IF EXISTS "Admins can update receipts" ON public.receipt_submissions;
CREATE POLICY "Admins can update receipts"
  ON public.receipt_submissions FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.is_superadmin(auth.uid()));

-- Trigger for updated_at on merchant_sale_confirmations
CREATE TRIGGER update_merchant_sale_confirmations_updated_at
  BEFORE UPDATE ON public.merchant_sale_confirmations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for confirmation lookups
CREATE INDEX IF NOT EXISTS idx_merchant_sale_confirmations_merchant_id ON public.merchant_sale_confirmations(merchant_id);
CREATE INDEX IF NOT EXISTS idx_merchant_sale_confirmations_status ON public.merchant_sale_confirmations(status);
