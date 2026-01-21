-- Create a dedicated catalog table for merchant products/services
CREATE TABLE public.invoice_catalog_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,
  unit_type TEXT DEFAULT 'unit',
  tax_rate NUMERIC(5,3) DEFAULT 0,
  category TEXT,
  sku TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for merchant lookup
CREATE INDEX idx_invoice_catalog_items_merchant ON public.invoice_catalog_items(merchant_id);
CREATE INDEX idx_invoice_catalog_items_active ON public.invoice_catalog_items(merchant_id, is_active);

-- Enable RLS
ALTER TABLE public.invoice_catalog_items ENABLE ROW LEVEL SECURITY;

-- Merchants can manage their own catalog items
CREATE POLICY "Merchants can view their catalog items"
ON public.invoice_catalog_items FOR SELECT
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can create catalog items"
ON public.invoice_catalog_items FOR INSERT
WITH CHECK (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can update their catalog items"
ON public.invoice_catalog_items FOR UPDATE
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Merchants can delete their catalog items"
ON public.invoice_catalog_items FOR DELETE
USING (
  merchant_id IN (
    SELECT id FROM public.merchants WHERE user_id = auth.uid()
  )
);

-- Add catalog_item_id reference to invoice_items
ALTER TABLE public.invoice_items 
ADD COLUMN IF NOT EXISTS catalog_item_id UUID REFERENCES public.invoice_catalog_items(id) ON DELETE SET NULL;

-- Updated_at trigger
CREATE TRIGGER update_invoice_catalog_items_updated_at
  BEFORE UPDATE ON public.invoice_catalog_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();