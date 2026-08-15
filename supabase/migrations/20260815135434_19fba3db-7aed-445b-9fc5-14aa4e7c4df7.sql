DROP POLICY IF EXISTS "Anyone can view active catalog items" ON public.invoice_catalog_items;

CREATE OR REPLACE VIEW public.invoice_catalog_items_public AS
SELECT id, merchant_id, name, description, unit_price, unit_type, sku, category
FROM public.invoice_catalog_items
WHERE is_active = true;

GRANT SELECT ON public.invoice_catalog_items_public TO anon, authenticated;

DROP POLICY IF EXISTS "Anyone can view availability overrides" ON public.merchant_availability_overrides;

CREATE OR REPLACE VIEW public.merchant_availability_overrides_public AS
SELECT id, merchant_id, override_date, is_available, start_time, end_time
FROM public.merchant_availability_overrides;

GRANT SELECT ON public.merchant_availability_overrides_public TO anon, authenticated;