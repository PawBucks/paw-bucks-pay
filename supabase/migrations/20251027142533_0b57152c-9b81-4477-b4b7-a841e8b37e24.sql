-- Create wallet_activity table for transaction logging
CREATE TABLE IF NOT EXISTS public.wallet_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  transaction_id UUID REFERENCES public.transactions(id),
  activity_type TEXT NOT NULL CHECK (activity_type IN ('credit', 'debit', 'cashback', 'referral_bonus', 'withdrawal')),
  amount NUMERIC NOT NULL,
  balance_before NUMERIC NOT NULL,
  balance_after NUMERIC NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.wallet_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for wallet_activity
CREATE POLICY "Users can view their own wallet activity"
  ON public.wallet_activity
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallet activity"
  ON public.wallet_activity
  FOR INSERT
  WITH CHECK (true);

-- Create index for faster queries
CREATE INDEX idx_wallet_activity_user_id ON public.wallet_activity(user_id);
CREATE INDEX idx_wallet_activity_created_at ON public.wallet_activity(created_at DESC);

-- Update the wallet update trigger to log activity
CREATE OR REPLACE FUNCTION public.log_wallet_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  old_balance NUMERIC;
  new_balance NUMERIC;
BEGIN
  -- Get wallet balances
  SELECT balance INTO old_balance FROM public.wallets WHERE user_id = NEW.pet_owner_id;
  
  -- Update wallet
  UPDATE public.wallets
  SET 
    balance = balance + NEW.cashback_amount,
    total_spent = total_spent + NEW.amount,
    rewards_points = rewards_points + NEW.rewards_earned,
    updated_at = now()
  WHERE user_id = NEW.pet_owner_id
  RETURNING balance INTO new_balance;
  
  -- Log cashback activity if applicable
  IF NEW.cashback_amount > 0 THEN
    INSERT INTO public.wallet_activity (
      user_id,
      transaction_id,
      activity_type,
      amount,
      balance_before,
      balance_after,
      description
    ) VALUES (
      NEW.pet_owner_id,
      NEW.id,
      'cashback',
      NEW.cashback_amount,
      old_balance,
      new_balance,
      'Cashback from ' || (SELECT business_name FROM merchants WHERE id = NEW.merchant_id)
    );
  END IF;
  
  -- Log transaction spend
  INSERT INTO public.wallet_activity (
    user_id,
    transaction_id,
    activity_type,
    amount,
    balance_before,
    balance_after,
    description
  ) VALUES (
    NEW.pet_owner_id,
    NEW.id,
    'debit',
    NEW.amount,
    new_balance,
    new_balance,
    'Purchase at ' || (SELECT business_name FROM merchants WHERE id = NEW.merchant_id)
  );
  
  RETURN NEW;
END;
$$;

-- Drop old trigger and create new one
DROP TRIGGER IF EXISTS update_wallet_after_transaction ON public.transactions;
CREATE TRIGGER update_wallet_after_transaction
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_wallet_activity();