
-- Update the update_wallet_after_transaction trigger to handle null user_ids
CREATE OR REPLACE FUNCTION public.update_wallet_after_transaction()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Skip wallet update for transactions without a user (manual invoice payments to unregistered clients)
  IF NEW.user_id IS NULL THEN
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
