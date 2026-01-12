-- Add columns to transactions table to track Stripe vs PawBucks portions and fees
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS stripe_amount numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS pawbucks_used integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS application_fee numeric DEFAULT 0;

-- Backfill existing transactions: Stripe transactions get fee, PawBucks-only get 0
UPDATE public.transactions 
SET 
  stripe_amount = CASE 
    WHEN stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id != '' THEN amount 
    ELSE 0 
  END,
  pawbucks_used = CASE 
    WHEN stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = '' THEN FLOOR(amount * 1000)::integer
    ELSE 0 
  END,
  application_fee = CASE 
    WHEN stripe_payment_intent_id IS NOT NULL AND stripe_payment_intent_id != '' THEN amount * 0.03 
    ELSE 0 
  END
WHERE stripe_amount = 0 AND application_fee = 0;