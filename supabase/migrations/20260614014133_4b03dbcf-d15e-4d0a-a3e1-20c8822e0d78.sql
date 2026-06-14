
-- 1. Table
CREATE TABLE public.transaction_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
  merchant_id uuid NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('catalog_item','pet_store_item','merchant_service','custom')),
  source_id uuid NULL,
  name text NOT NULL,
  description text NULL,
  sku text NULL,
  quantity numeric(12,3) NOT NULL DEFAULT 1 CHECK (quantity > 0),
  unit_price numeric(12,2) NOT NULL DEFAULT 0 CHECK (unit_price >= 0),
  total numeric(14,2) GENERATED ALWAYS AS (round(quantity * unit_price, 2)) STORED,
  image_url text NULL,
  inventory_decremented boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_transaction_items_txn ON public.transaction_items(transaction_id);
CREATE INDEX idx_transaction_items_merchant_created ON public.transaction_items(merchant_id, created_at DESC);
CREATE INDEX idx_transaction_items_source ON public.transaction_items(source_type, source_id);

-- 2. GRANTs
GRANT SELECT ON public.transaction_items TO authenticated;
GRANT ALL ON public.transaction_items TO service_role;

-- 3. RLS
ALTER TABLE public.transaction_items ENABLE ROW LEVEL SECURITY;

-- Customer can read items for their own transactions
CREATE POLICY "Customers can view their transaction items"
ON public.transaction_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.transactions t
    WHERE t.id = transaction_items.transaction_id
      AND t.user_id = auth.uid()
  )
);

-- Merchant owner can read items for transactions at their merchant
CREATE POLICY "Merchants can view items sold at their business"
ON public.transaction_items
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m
    WHERE m.id = transaction_items.merchant_id
      AND m.user_id = auth.uid()
  )
);

-- 4. Inventory decrement trigger (Pet Store items)
CREATE OR REPLACE FUNCTION public.tg_transaction_items_decrement_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.source_type = 'pet_store_item' AND NEW.source_id IS NOT NULL AND NEW.inventory_decremented = false THEN
    UPDATE public.pet_store_items
    SET stock_quantity = GREATEST(0, COALESCE(stock_quantity, 0) - NEW.quantity::int)
    WHERE id = NEW.source_id
      AND stock_quantity IS NOT NULL;
    IF FOUND THEN
      NEW.inventory_decremented := true;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_transaction_items_decrement_inventory
BEFORE INSERT ON public.transaction_items
FOR EACH ROW EXECUTE FUNCTION public.tg_transaction_items_decrement_inventory();

-- 5. Inventory restore helper (called from refund edge function)
CREATE OR REPLACE FUNCTION public.restore_transaction_inventory(p_transaction_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.pet_store_items psi
  SET stock_quantity = COALESCE(psi.stock_quantity, 0) + ti.quantity::int
  FROM public.transaction_items ti
  WHERE ti.transaction_id = p_transaction_id
    AND ti.source_type = 'pet_store_item'
    AND ti.source_id IS NOT NULL
    AND ti.inventory_decremented = true
    AND psi.id = ti.source_id
    AND psi.stock_quantity IS NOT NULL;

  UPDATE public.transaction_items
  SET inventory_decremented = false
  WHERE transaction_id = p_transaction_id
    AND source_type = 'pet_store_item'
    AND inventory_decremented = true;
END;
$$;

-- 6. Items-sold aggregation (used by the Items Sold report)
CREATE OR REPLACE FUNCTION public.merchant_items_sold_report(
  p_merchant_id uuid,
  p_start timestamptz,
  p_end timestamptz
)
RETURNS TABLE (
  name text,
  sku text,
  source_type text,
  total_quantity numeric,
  total_revenue numeric,
  transaction_count bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ti.name,
    ti.sku,
    ti.source_type,
    SUM(ti.quantity)::numeric AS total_quantity,
    SUM(ti.total)::numeric AS total_revenue,
    COUNT(DISTINCT ti.transaction_id)::bigint AS transaction_count
  FROM public.transaction_items ti
  JOIN public.transactions t ON t.id = ti.transaction_id
  JOIN public.merchants m ON m.id = ti.merchant_id
  WHERE ti.merchant_id = p_merchant_id
    AND m.user_id = auth.uid()
    AND t.status <> 'refunded'
    AND ti.created_at >= p_start
    AND ti.created_at < p_end
  GROUP BY ti.name, ti.sku, ti.source_type
  ORDER BY total_revenue DESC;
$$;

GRANT EXECUTE ON FUNCTION public.merchant_items_sold_report(uuid, timestamptz, timestamptz) TO authenticated;
