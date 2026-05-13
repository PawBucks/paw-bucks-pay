
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS amount_refunded numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pawbucks_refunded integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.refund_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL,
  initiated_by uuid,
  refund_amount numeric(10,2) NOT NULL,
  pawbucks_earned_reversed integer NOT NULL DEFAULT 0,
  pawbucks_spent_returned integer NOT NULL DEFAULT 0,
  stripe_refund_id text,
  status text NOT NULL DEFAULT 'succeeded',
  reason text,
  note text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_refund_attempts_transaction ON public.refund_attempts(transaction_id);

ALTER TABLE public.refund_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins view all refund attempts"
  ON public.refund_attempts FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role));

CREATE POLICY "Merchants view their refund attempts"
  ON public.refund_attempts FOR SELECT TO authenticated
  USING (
    merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
  );
