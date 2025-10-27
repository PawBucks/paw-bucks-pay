-- Add cashback_rate to merchants table
ALTER TABLE public.merchants ADD COLUMN cashback_rate DECIMAL(5, 2) NOT NULL DEFAULT 5.00;

-- Add total_spent to wallets table
ALTER TABLE public.wallets ADD COLUMN total_spent DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Update transactions table to better track cashback
ALTER TABLE public.transactions ADD COLUMN cashback_amount DECIMAL(10, 2) NOT NULL DEFAULT 0.00;

-- Function to update wallet after transaction
CREATE OR REPLACE FUNCTION public.update_wallet_after_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the pet owner's wallet
  UPDATE public.wallets
  SET 
    balance = balance + NEW.cashback_amount,
    total_spent = total_spent + NEW.amount,
    rewards_points = rewards_points + NEW.rewards_earned,
    updated_at = now()
  WHERE user_id = NEW.pet_owner_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Trigger to auto-update wallet after transaction
CREATE TRIGGER on_transaction_created_update_wallet
  AFTER INSERT ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_wallet_after_transaction();