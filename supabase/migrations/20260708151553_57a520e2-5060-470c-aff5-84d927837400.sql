
-- 1. Fix trigger to stop crediting PawBucks as USD into wallets.balance
CREATE OR REPLACE FUNCTION public.log_wallet_activity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  current_balance NUMERIC;
  wallet_record_id UUID;
  merchant_name TEXT;
  activity_description TEXT;
BEGIN
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT balance, id INTO current_balance, wallet_record_id
  FROM public.wallets
  WHERE user_id = NEW.user_id;

  IF wallet_record_id IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT business_name INTO merchant_name FROM merchants WHERE id = NEW.merchant_id;

  IF NEW.description IS NOT NULL AND NEW.description LIKE 'Invoice #%' THEN
    activity_description := NEW.description;
  ELSE
    activity_description := 'Payment to ' || COALESCE(merchant_name, 'Merchant');
  END IF;

  -- Update total_spent and rewards_points ONLY; do NOT credit PawBucks into USD balance
  UPDATE public.wallets
  SET
    total_spent = COALESCE(total_spent, 0) + NEW.amount,
    rewards_points = COALESCE(rewards_points, 0) + COALESCE(NEW.rewards_earned, 0),
    last_updated = now()
  WHERE user_id = NEW.user_id;

  -- Log transaction spend for history
  INSERT INTO public.wallet_activity (
    user_id, wallet_id, transaction_id, type, amount, balance_before, balance_after, description
  ) VALUES (
    NEW.user_id, wallet_record_id, NEW.id, 'debit', NEW.amount, current_balance, current_balance, activity_description
  );

  RETURN NEW;
END;
$function$;

-- 2. Purge polluted cashback entries from wallet_activity
DELETE FROM public.wallet_activity WHERE type = 'cashback';

-- 3. Recompute wallets.balance from remaining real cash activity (credit - debit)
UPDATE public.wallets w
SET balance = COALESCE((
  SELECT SUM(CASE WHEN type = 'credit' THEN amount
                  WHEN type = 'debit' THEN -amount
                  ELSE 0 END)
  FROM public.wallet_activity wa
  WHERE wa.user_id = w.user_id
), 0),
last_updated = now();

-- Floor negatives to 0 (debits without real credits shouldn't go below zero)
UPDATE public.wallets SET balance = 0 WHERE balance < 0;

-- 4. Recompute pawbucks_wallet.balance platform-wide from pawbucks_activity ledger
UPDATE public.pawbucks_wallet pw
SET balance = COALESCE((
  SELECT SUM(CASE WHEN type = 'earn' THEN amount
                  WHEN type = 'redeem' THEN -amount
                  ELSE 0 END)
  FROM public.pawbucks_activity pa
  WHERE pa.user_id = pw.user_id
    AND COALESCE(pa.pawbucks_status, 'available') <> 'expired'
), 0),
last_updated = now();

UPDATE public.pawbucks_wallet SET balance = 0 WHERE balance < 0;
