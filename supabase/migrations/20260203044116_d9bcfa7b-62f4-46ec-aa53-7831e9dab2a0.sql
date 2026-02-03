
-- Update the log_wallet_activity trigger to handle null user_ids (manual invoice payments)
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
  -- Skip wallet logging for transactions without a user (manual invoice payments to unregistered clients)
  IF NEW.user_id IS NULL THEN
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
