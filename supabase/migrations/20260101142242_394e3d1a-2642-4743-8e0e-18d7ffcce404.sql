-- Add merchant_id to pet_store_items to track which merchant listed the product
ALTER TABLE public.pet_store_items 
ADD COLUMN IF NOT EXISTS merchant_id uuid REFERENCES public.merchants(id) ON DELETE SET NULL;

-- Add index for efficient querying
CREATE INDEX IF NOT EXISTS idx_pet_store_items_merchant_id ON public.pet_store_items(merchant_id);

-- Update RLS policy to allow merchants to manage their own pet store items
CREATE POLICY "Merchants can insert their own pet store items" 
ON public.pet_store_items 
FOR INSERT 
WITH CHECK (
  merchant_id IS NOT NULL AND 
  merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
);

CREATE POLICY "Merchants can update their own pet store items" 
ON public.pet_store_items 
FOR UPDATE 
USING (
  merchant_id IS NOT NULL AND 
  merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
);

CREATE POLICY "Merchants can delete their own pet store items" 
ON public.pet_store_items 
FOR DELETE 
USING (
  merchant_id IS NOT NULL AND 
  merchant_id IN (SELECT id FROM merchants WHERE user_id = auth.uid())
);