-- Make pawbucks_activity ledger the single source of truth for pawbucks_wallet.balance.
-- Uses FIFO consumption in chronological order with clamping at 0, so historical
-- over-redemptions cannot silently eat into future earned PawBucks.

CREATE OR REPLACE FUNCTION public.recompute_pawbucks_wallet(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint := 0;
  r RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT type, amount, pawbucks_status
    FROM pawbucks_activity
    WHERE user_id = p_user_id
    ORDER BY created_at ASC, id ASC
  LOOP
    IF r.type = 'earn' AND r.pawbucks_status = 'available' THEN
      v_balance := v_balance + r.amount;
    ELSIF r.type = 'redeem' THEN
      -- All redeem rows (including expiration offsets) reduce balance; clamped at 0.
      v_balance := GREATEST(v_balance - r.amount, 0);
    END IF;
  END LOOP;

  INSERT INTO pawbucks_wallet (user_id, balance, last_updated)
  VALUES (p_user_id, v_balance::int, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance, last_updated = now();

  RETURN v_balance::int;
END $$;

CREATE OR REPLACE FUNCTION public.trg_sync_pawbucks_wallet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recompute_pawbucks_wallet(OLD.user_id);
  ELSE
    PERFORM public.recompute_pawbucks_wallet(NEW.user_id);
    IF TG_OP = 'UPDATE' AND NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      PERFORM public.recompute_pawbucks_wallet(OLD.user_id);
    END IF;
  END IF;
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS pawbucks_activity_sync_wallet ON public.pawbucks_activity;
CREATE TRIGGER pawbucks_activity_sync_wallet
AFTER INSERT OR UPDATE OR DELETE ON public.pawbucks_activity
FOR EACH ROW EXECUTE FUNCTION public.trg_sync_pawbucks_wallet();

-- Ensure every user with activity has a wallet row, then recompute all balances.
INSERT INTO public.pawbucks_wallet (user_id, balance)
SELECT DISTINCT user_id, 0
FROM public.pawbucks_activity
WHERE user_id IS NOT NULL
ON CONFLICT (user_id) DO NOTHING;

DO $$
DECLARE u RECORD;
BEGIN
  FOR u IN SELECT DISTINCT user_id FROM public.pawbucks_wallet LOOP
    PERFORM public.recompute_pawbucks_wallet(u.user_id);
  END LOOP;
END $$;