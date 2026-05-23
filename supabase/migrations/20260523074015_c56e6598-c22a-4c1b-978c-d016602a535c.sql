ALTER TABLE public.direct_payments
  ADD COLUMN IF NOT EXISTS last_error text;