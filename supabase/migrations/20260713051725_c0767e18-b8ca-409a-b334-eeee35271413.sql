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
      SELECT created_at AS event_at, 'earn'::text AS event_kind, id AS activity_id, amount, created_at, id
      FROM public.pawbucks_activity
      WHERE user_id = p_user_id
        AND type = 'earn'
        AND pawbucks_status IN ('available', 'expired')

      UNION ALL

      SELECT expires_at AS event_at, 'expire'::text AS event_kind, id AS activity_id, amount, created_at, id
      FROM public.pawbucks_activity
      WHERE user_id = p_user_id
        AND type = 'earn'
        AND pawbucks_status IN ('available', 'expired')
        AND expires_at IS NOT NULL
        AND expires_at <= now()

      UNION ALL

      SELECT created_at AS event_at, 'redeem'::text AS event_kind, id AS activity_id, amount, created_at, id
      FROM public.pawbucks_activity
      WHERE user_id = p_user_id
        AND type = 'redeem'
        AND source <> 'expiration'
    ) events
    ORDER BY event_at ASC,
      CASE event_kind WHEN 'earn' THEN 1 WHEN 'expire' THEN 2 ELSE 3 END,
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

  SELECT COALESCE(SUM(remaining), 0)
  INTO v_balance
  FROM pg_temp._pb_recompute_buckets;

  INSERT INTO public.pawbucks_wallet (user_id, balance, last_updated)
  VALUES (p_user_id, v_balance::int, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance,
        last_updated = now();

  RETURN v_balance::int;
END;
$$;