
-- Fix update_wallet_after_transaction to only process completed transactions
CREATE OR REPLACE FUNCTION public.update_wallet_after_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip wallet update for non-completed transactions or transactions without a user
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Update the pet owner's wallet
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

-- Fix log_wallet_activity to only process completed transactions
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
  merchant_name TEXT;
  activity_description TEXT;
BEGIN
  -- Skip for non-completed transactions or transactions without a user
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get wallet balances and ID
  SELECT balance, id INTO old_balance, wallet_record_id 
  FROM public.wallets 
  WHERE user_id = NEW.user_id;
  
  -- If no wallet found, skip logging
  IF wallet_record_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get merchant name for fallback
  SELECT business_name INTO merchant_name FROM merchants WHERE id = NEW.merchant_id;
  
  -- Determine the activity description
  IF NEW.description IS NOT NULL AND NEW.description LIKE 'Invoice #%' THEN
    activity_description := NEW.description;
  ELSE
    activity_description := 'Payment to ' || COALESCE(merchant_name, 'Merchant');
  END IF;
  
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
      user_id, wallet_id, transaction_id, type, amount, balance_before, balance_after, description
    ) VALUES (
      NEW.user_id, wallet_record_id, NEW.id, 'cashback', NEW.cashback_earned, old_balance, new_balance,
      'Rewards from ' || activity_description
    );
  END IF;
  
  -- Log transaction spend
  INSERT INTO public.wallet_activity (
    user_id, wallet_id, transaction_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    NEW.user_id, wallet_record_id, NEW.id, 'debit', NEW.amount, new_balance, new_balance, activity_description
  );
  
  RETURN NEW;
END;
$function$;

-- Recalculate wallets.total_spent from only completed transactions
UPDATE wallets w
SET total_spent = COALESCE(
  (SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = w.user_id AND t.status = 'completed'),
  0
);
