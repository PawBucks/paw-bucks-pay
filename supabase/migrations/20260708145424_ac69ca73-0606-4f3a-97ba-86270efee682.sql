
CREATE TABLE IF NOT EXISTS public.transaction_reconciliation_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL,
  stripe_payment_intent_id text,
  stripe_account_id text,
  action text NOT NULL, -- 'restored','skipped_exists','skipped_no_metadata','error'
  target_table text,    -- 'transactions','invoice_payments','direct_payments', etc
  restored_transaction_id uuid,
  amount numeric(10,2),
  merchant_id uuid,
  user_id uuid,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_txn_recon_log_run ON public.transaction_reconciliation_log(run_id);
CREATE INDEX IF NOT EXISTS idx_txn_recon_log_pi ON public.transaction_reconciliation_log(stripe_payment_intent_id);
CREATE INDEX IF NOT EXISTS idx_txn_recon_log_action ON public.transaction_reconciliation_log(action, created_at DESC);

GRANT SELECT ON public.transaction_reconciliation_log TO authenticated;
GRANT ALL ON public.transaction_reconciliation_log TO service_role;

ALTER TABLE public.transaction_reconciliation_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view reconciliation log"
  ON public.transaction_reconciliation_log
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
