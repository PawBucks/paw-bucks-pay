-- Fix: award_referral_bonus should credit PawBucks (pawbucks_wallet + pawbucks_activity)
-- instead of the old wallets table
CREATE OR REPLACE FUNCTION public.award_referral_bonus()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_record RECORD;
  v_referrer_bonus INTEGER;
  v_referee_bonus INTEGER;
BEGIN
  -- Only process completed transactions
  IF NEW.status != 'completed' OR NEW.user_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if this is the referee's first completed transaction
  IF (SELECT COUNT(*) FROM public.transactions WHERE user_id = NEW.user_id AND status = 'completed') > 1 THEN
    RETURN NEW;
  END IF;

  -- Find referral record for this user where bonuses haven't been awarded yet
  SELECT * INTO referral_record
  FROM public.referrals
  WHERE referee_id = NEW.user_id
    AND (referrer_bonus_awarded = false OR referrer_bonus_awarded IS NULL);

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_referrer_bonus := COALESCE(referral_record.referrer_bonus_amount, 10) * 100; -- Convert to PawBucks cents
  v_referee_bonus := COALESCE(referral_record.referee_bonus_amount, 10) * 100;

  -- Award PawBucks to referrer
  UPDATE public.pawbucks_wallet
  SET balance = balance + v_referrer_bonus
  WHERE user_id = referral_record.referrer_id;

  INSERT INTO public.pawbucks_activity (user_id, type, amount, description, source, pawbucks_status)
  VALUES (referral_record.referrer_id, 'credit', v_referrer_bonus, 
    'Referral bonus - your friend made their first transaction!', 'referral', 'available');

  -- Award PawBucks to referee
  UPDATE public.pawbucks_wallet
  SET balance = balance + v_referee_bonus
  WHERE user_id = referral_record.referee_id;

  INSERT INTO public.pawbucks_activity (user_id, type, amount, description, source, pawbucks_status)
  VALUES (referral_record.referee_id, 'credit', v_referee_bonus,
    'Referral signup bonus - welcome to PawBucks!', 'referral', 'available');

  -- Mark bonuses as awarded
  UPDATE public.referrals
  SET 
    referrer_bonus_awarded = true,
    referee_bonus_awarded = true
  WHERE id = referral_record.id;

  -- Notify referrer
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (
    referral_record.referrer_id,
    '🎉 Referral Bonus Earned!',
    'Your friend completed their first transaction! You both earned $' || COALESCE(referral_record.referrer_bonus_amount, 10) || ' in PawBucks!',
    'promotional'
  );

  RETURN NEW;
END;
$$;