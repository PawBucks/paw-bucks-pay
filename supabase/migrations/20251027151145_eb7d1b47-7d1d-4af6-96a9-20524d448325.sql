-- Update database function to use new column names
-- This function is triggered when new transactions are inserted

DROP FUNCTION IF EXISTS public.log_wallet_activity() CASCADE;

CREATE OR REPLACE FUNCTION public.log_wallet_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  old_balance NUMERIC;
  new_balance NUMERIC;
  wallet_record_id UUID;
BEGIN
  -- Get wallet balances and ID
  SELECT balance, id INTO old_balance, wallet_record_id 
  FROM public.wallets 
  WHERE user_id = NEW.user_id;
  
  -- Update wallet
  UPDATE public.wallets
  SET 
    balance = balance + NEW.cashback_earned,
    total_spent = total_spent + NEW.amount,
    rewards_points = rewards_points + NEW.rewards_earned,
    last_updated = now()
  WHERE user_id = NEW.user_id
  RETURNING balance INTO new_balance;
  
  -- Log cashback activity if applicable
  IF NEW.cashback_earned > 0 THEN
    INSERT INTO public.wallet_activity (
      user_id,
      wallet_id,
      transaction_id,
      type,
      amount,
      balance_before,
      balance_after,
      description
    ) VALUES (
      NEW.user_id,
      wallet_record_id,
      NEW.id,
      'cashback',
      NEW.cashback_earned,
      old_balance,
      new_balance,
      'Cashback from ' || (SELECT business_name FROM merchants WHERE id = NEW.merchant_id)
    );
  END IF;
  
  -- Log transaction spend
  INSERT INTO public.wallet_activity (
    user_id,
    wallet_id,
    transaction_id,
    type,
    amount,
    balance_before,
    balance_after,
    description
  ) VALUES (
    NEW.user_id,
    wallet_record_id,
    NEW.id,
    'debit',
    NEW.amount,
    new_balance,
    new_balance,
    'Purchase at ' || (SELECT business_name FROM merchants WHERE id = NEW.merchant_id)
  );
  
  RETURN NEW;
END;
$function$;

-- Recreate the trigger
DROP TRIGGER IF EXISTS on_transaction_created ON public.transactions;
CREATE TRIGGER on_transaction_created
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.log_wallet_activity();

-- Update the simpler wallet update function as well
DROP FUNCTION IF EXISTS public.update_wallet_after_transaction() CASCADE;

CREATE OR REPLACE FUNCTION public.update_wallet_after_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Update the pet owner's wallet (renamed from pet_owner_id to user_id)
  UPDATE public.wallets
  SET 
    balance = balance + NEW.cashback_earned,
    total_spent = total_spent + NEW.amount,
    rewards_points = rewards_points + NEW.rewards_earned,
    last_updated = now()
  WHERE user_id = NEW.user_id;
  
  RETURN NEW;
END;
$function$;

-- Update get_merchant_analytics function to use new column names
DROP FUNCTION IF EXISTS public.get_merchant_analytics(uuid);

CREATE OR REPLACE FUNCTION public.get_merchant_analytics(_merchant_id uuid)
RETURNS TABLE(
  merchant_id uuid,
  business_name text,
  total_transactions bigint,
  total_customers bigint,
  total_earnings numeric,
  total_cashback_paid numeric,
  avg_transaction_amount numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $function$
  SELECT 
    m.id as merchant_id,
    m.business_name,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT t.user_id) as total_customers,
    COALESCE(SUM(t.amount), 0) as total_earnings,
    COALESCE(SUM(t.cashback_earned), 0) as total_cashback_paid,
    COALESCE(AVG(t.amount), 0) as avg_transaction_amount
  FROM public.merchants m
  LEFT JOIN public.transactions t ON m.id = t.merchant_id
  WHERE m.id = _merchant_id AND m.user_id = auth.uid()
  GROUP BY m.id, m.business_name;
$function$;

-- Update award_referral_bonus function to use new column names
DROP FUNCTION IF EXISTS public.award_referral_bonus() CASCADE;

CREATE OR REPLACE FUNCTION public.award_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  referral_record RECORD;
BEGIN
  -- Check if this is the referee's first transaction (using user_id instead of pet_owner_id)
  IF (SELECT COUNT(*) FROM public.transactions WHERE user_id = NEW.user_id) = 1 THEN
    -- Find referral record for this user
    SELECT * INTO referral_record
    FROM public.referrals
    WHERE referee_id = NEW.user_id
    AND referee_bonus_awarded = false;
    
    IF FOUND THEN
      -- Award bonus to referee
      UPDATE public.wallets
      SET balance = balance + referral_record.referee_bonus_amount
      WHERE user_id = referral_record.referee_id;
      
      -- Award bonus to referrer
      UPDATE public.wallets
      SET balance = balance + referral_record.referrer_bonus_amount
      WHERE user_id = referral_record.referrer_id;
      
      -- Mark bonuses as awarded
      UPDATE public.referrals
      SET 
        referrer_bonus_awarded = true,
        referee_bonus_awarded = true
      WHERE id = referral_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Recreate referral bonus trigger
DROP TRIGGER IF EXISTS on_transaction_referral_check ON public.transactions;
CREATE TRIGGER on_transaction_referral_check
  AFTER INSERT ON public.transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.award_referral_bonus();

COMMENT ON FUNCTION public.log_wallet_activity() IS 'Updated to use user_id, cashback_earned, and wallet_id columns';
COMMENT ON FUNCTION public.update_wallet_after_transaction() IS 'Updated to use user_id and cashback_earned columns';
COMMENT ON FUNCTION public.get_merchant_analytics(uuid) IS 'Updated to use user_id and cashback_earned columns';
COMMENT ON FUNCTION public.award_referral_bonus() IS 'Updated to use user_id column';
