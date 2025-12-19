-- Add separate PawBucks price column for pet store items
ALTER TABLE public.pet_store_items 
ADD COLUMN price_pawbucks integer NOT NULL DEFAULT 0;

-- Add a comment to clarify the columns
COMMENT ON COLUMN public.pet_store_items.price IS 'USD price in cents';
COMMENT ON COLUMN public.pet_store_items.price_pawbucks IS 'PawBucks price (discounted rate when paying with PawBucks)';