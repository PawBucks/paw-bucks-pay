-- No schema changes; brand_id already exists on partner_offers. This is a no-op
-- safety check that fails fast if the column is somehow missing.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partner_offers' AND column_name='brand_id'
  ) THEN
    RAISE EXCEPTION 'partner_offers.brand_id missing; run brand pipeline migration first';
  END IF;
END $$;