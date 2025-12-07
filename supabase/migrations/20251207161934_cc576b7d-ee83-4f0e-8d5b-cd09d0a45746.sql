-- Add updated_at column to transactions table (the update_updated_at_column trigger expects it)
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now();

-- Drop any existing trigger that might be causing the issue
DROP TRIGGER IF EXISTS update_transactions_updated_at ON public.transactions;

-- Recreate the trigger properly
CREATE TRIGGER update_transactions_updated_at
  BEFORE UPDATE ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();