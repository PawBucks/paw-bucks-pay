-- Add price_range column to merchants table
ALTER TABLE public.merchants 
ADD COLUMN price_range integer DEFAULT 2 CHECK (price_range >= 1 AND price_range <= 4);

-- Add comment for documentation
COMMENT ON COLUMN public.merchants.price_range IS 'Price range indicator: 1=$, 2=$$, 3=$$$, 4=$$$$';