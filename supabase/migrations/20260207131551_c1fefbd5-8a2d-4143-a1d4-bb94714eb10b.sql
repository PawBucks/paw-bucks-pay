-- Add payment_method column to transactions table for tracking manual payment methods
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_method text DEFAULT 'card';

-- Add comment for clarity
COMMENT ON COLUMN public.transactions.payment_method IS 'Payment method used: card, cash, check, bank_transfer, venmo, paypal, zelle, other';