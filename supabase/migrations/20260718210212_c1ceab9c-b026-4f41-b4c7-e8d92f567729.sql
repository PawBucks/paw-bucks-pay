
-- 1) Guard trigger: force wallet.balance to equal the ledger recompute
CREATE OR REPLACE FUNCTION public.trg_pawbucks_wallet_force_ledger()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_correct bigint;
BEGIN
  -- Skip when recompute_pawbucks_wallet is the caller (it sets this flag).
  IF current_setting('pawbucks.internal_recompute', true) = 'on' THEN
    RETURN NEW;
  END IF;

  -- Compute correct balance from ledger and force it.
  SELECT COALESCE(SUM(
           CASE
             WHEN pa.type = 'earn'
                  AND pa.pawbucks_status = 'available'
                  AND (pa.expires_at IS NULL OR pa.expires_at > now())
               THEN pa.amount
             WHEN pa.type = 'redeem' AND pa.source <> 'expiration'
               THEN -pa.amount
             ELSE 0
           END
         ), 0)
    INTO v_correct
  FROM public.pawbucks_activity pa
  WHERE pa.user_id = NEW.user_id;

  -- Clamp to non-negative and use FIFO-accurate recompute for authoritative value
  PERFORM set_config('pawbucks.internal_recompute', 'on', true);
  v_correct := public.recompute_pawbucks_wallet(NEW.user_id);
  PERFORM set_config('pawbucks.internal_recompute', 'off', true);

  -- recompute already wrote the wallet; suppress this UPDATE
  RETURN NULL;
END $$;

-- Update recompute function to mark its own updates as internal
CREATE OR REPLACE FUNCTION public.recompute_pawbucks_wallet(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance bigint := 0;
  v_remaining_to_consume bigint;
  v_take bigint;
  e RECORD;
  b RECORD;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN 0;
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS pg_temp._pb_recompute_buckets (
    earn_id uuid PRIMARY KEY,
    remaining bigint NOT NULL,
    earned_at timestamptz NOT NULL
  ) ON COMMIT DROP;
  TRUNCATE pg_temp._pb_recompute_buckets;

  FOR e IN
    SELECT event_at, event_kind, activity_id, amount, created_at
    FROM (
      SELECT
        COALESCE(t.created_at, pa.created_at) AS event_at,
        'earn'::text AS event_kind,
        pa.id AS activity_id,
        pa.amount,
        pa.created_at,
        pa.id
      FROM public.pawbucks_activity pa
      LEFT JOIN public.transactions t ON t.id = pa.transaction_id
      WHERE pa.user_id = p_user_id
        AND pa.type = 'earn'
        AND pa.pawbucks_status IN ('available', 'expired')

      UNION ALL

      SELECT
        pa.expires_at AS event_at,
        'expire'::text AS event_kind,
        pa.id AS activity_id,
        pa.amount,
        pa.created_at,
        pa.id
      FROM public.pawbucks_activity pa
      WHERE pa.user_id = p_user_id
        AND pa.type = 'earn'
        AND pa.pawbucks_status IN ('available', 'expired')
        AND pa.expires_at IS NOT NULL
        AND pa.expires_at <= now()

      UNION ALL

      SELECT
        COALESCE(t.created_at, pa.created_at) AS event_at,
        'redeem'::text AS event_kind,
        pa.id AS activity_id,
        pa.amount,
        pa.created_at,
        pa.id
      FROM public.pawbucks_activity pa
      LEFT JOIN public.transactions t ON t.id = pa.transaction_id
      WHERE pa.user_id = p_user_id
        AND pa.type = 'redeem'
        AND pa.source <> 'expiration'
    ) events
    ORDER BY event_at ASC,
      CASE event_kind WHEN 'expire' THEN 1 WHEN 'redeem' THEN 2 WHEN 'earn' THEN 3 ELSE 4 END,
      created_at ASC,
      id ASC
  LOOP
    IF e.event_kind = 'earn' THEN
      INSERT INTO pg_temp._pb_recompute_buckets (earn_id, remaining, earned_at)
      VALUES (e.activity_id, e.amount, e.created_at)
      ON CONFLICT (earn_id) DO NOTHING;

    ELSIF e.event_kind = 'expire' THEN
      DELETE FROM pg_temp._pb_recompute_buckets
      WHERE earn_id = e.activity_id;

    ELSIF e.event_kind = 'redeem' THEN
      v_remaining_to_consume := e.amount;
      FOR b IN
        SELECT earn_id, remaining
        FROM pg_temp._pb_recompute_buckets
        WHERE remaining > 0
        ORDER BY earned_at ASC, earn_id ASC
      LOOP
        EXIT WHEN v_remaining_to_consume <= 0;
        v_take := LEAST(b.remaining, v_remaining_to_consume);
        UPDATE pg_temp._pb_recompute_buckets
        SET remaining = remaining - v_take
        WHERE earn_id = b.earn_id;
        v_remaining_to_consume := v_remaining_to_consume - v_take;
      END LOOP;
    END IF;
  END LOOP;

  SELECT COALESCE(SUM(remaining), 0) INTO v_balance
  FROM pg_temp._pb_recompute_buckets;

  IF v_balance < 0 THEN v_balance := 0; END IF;

  -- Set flag so the guard trigger allows this write
  PERFORM set_config('pawbucks.internal_recompute', 'on', true);

  INSERT INTO public.pawbucks_wallet (user_id, balance, last_updated)
  VALUES (p_user_id, v_balance, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance,
        last_updated = now();

  PERFORM set_config('pawbucks.internal_recompute', 'off', true);

  RETURN v_balance::integer;
END $$;

-- Attach the guard trigger to pawbucks_wallet (fires on UPDATE and INSERT of balance)
DROP TRIGGER IF EXISTS trg_pawbucks_wallet_force_ledger ON public.pawbucks_wallet;
CREATE TRIGGER trg_pawbucks_wallet_force_ledger
BEFORE UPDATE OF balance ON public.pawbucks_wallet
FOR EACH ROW
EXECUTE FUNCTION public.trg_pawbucks_wallet_force_ledger();

-- 2) Backfill: recompute every wallet from the ledger to fix all historical drift
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT DISTINCT user_id FROM public.pawbucks_wallet LOOP
    PERFORM public.recompute_pawbucks_wallet(r.user_id);
  END LOOP;
END $$;
