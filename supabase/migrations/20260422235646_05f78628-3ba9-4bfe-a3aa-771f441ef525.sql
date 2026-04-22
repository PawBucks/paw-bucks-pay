-- Add fee model fields to merchants table
ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS fee_model text NOT NULL DEFAULT 'full_ecosystem',
  ADD COLUMN IF NOT EXISTS acquisition_fee_rate numeric(5,2) NOT NULL DEFAULT 10.00;

-- Validate fee_model values
ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_fee_model_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_fee_model_check
  CHECK (fee_model IN ('full_ecosystem', 'acquisition_only'));

-- Validate acquisition fee rate range (0-100%)
ALTER TABLE public.merchants
  DROP CONSTRAINT IF EXISTS merchants_acquisition_fee_rate_check;
ALTER TABLE public.merchants
  ADD CONSTRAINT merchants_acquisition_fee_rate_check
  CHECK (acquisition_fee_rate >= 0 AND acquisition_fee_rate <= 100);

-- Index to speed up "is this customer new to this merchant?" lookups in fee calculation
CREATE INDEX IF NOT EXISTS idx_transactions_merchant_user_status
  ON public.transactions (merchant_id, user_id, status);

-- Helper function: returns true if user has at least one prior completed transaction at this merchant
CREATE OR REPLACE FUNCTION public.is_returning_customer(p_merchant_id uuid, p_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.transactions
    WHERE merchant_id = p_merchant_id
      AND user_id = p_user_id
      AND status = 'completed'
  );
$$;