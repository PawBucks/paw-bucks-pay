-- Add accepts_pawbucks column to merchants table
ALTER TABLE public.merchants 
ADD COLUMN accepts_pawbucks boolean NOT NULL DEFAULT false;

-- Add comment for documentation
COMMENT ON COLUMN public.merchants.accepts_pawbucks IS 'Whether this merchant accepts PawBucks as a form of payment';