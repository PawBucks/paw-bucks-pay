ALTER TABLE public.merchant_loyalty_programs
  ADD COLUMN IF NOT EXISTS qualifying_service_ids uuid[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS qualifying_categories text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS exclude_pawbucks_only boolean NOT NULL DEFAULT true;