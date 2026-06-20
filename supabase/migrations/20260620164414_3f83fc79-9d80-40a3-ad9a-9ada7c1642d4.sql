ALTER TABLE public.pet_store_items ADD COLUMN IF NOT EXISTS sku TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS pet_store_items_merchant_sku_unique
  ON public.pet_store_items (merchant_id, sku)
  WHERE sku IS NOT NULL AND merchant_id IS NOT NULL;