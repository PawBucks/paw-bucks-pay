ALTER TABLE public.merchant_pos_integrations
  ADD COLUMN IF NOT EXISTS clover_merchant_id text;

CREATE INDEX IF NOT EXISTS merchant_pos_integrations_clover_merchant_id_idx
  ON public.merchant_pos_integrations(clover_merchant_id)
  WHERE clover_merchant_id IS NOT NULL;