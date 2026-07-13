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
    FROM public.pawbucks_activity
    WHERE user_id = p_user_id
    ORDER BY created_at ASC, id ASC
  LOOP
    IF r.type = 'earn' AND r.pawbucks_status = 'available' THEN
      v_balance := v_balance + r.amount;
    ELSIF r.type = 'redeem' THEN
      v_balance := GREATEST(v_balance - r.amount, 0);
    END IF;
  END LOOP;

  INSERT INTO public.pawbucks_wallet (user_id, balance, last_updated)
  VALUES (p_user_id, v_balance::int, now())
  ON CONFLICT (user_id) DO UPDATE
    SET balance = EXCLUDED.balance,
        last_updated = now();

  RETURN v_balance::int;
END;
$$;

CREATE OR REPLACE FUNCTION public.expire_pawbucks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_expired_count integer := 0;
  u RECORD;
  e RECORD;
  b RECORD;
  v_remaining_to_consume bigint;
  v_take bigint;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id
    FROM public.pawbucks_activity
    WHERE user_id IS NOT NULL
      AND (
        (type = 'earn' AND pawbucks_status = 'available')
        OR type = 'redeem'
      )
  LOOP
    CREATE TEMP TABLE IF NOT EXISTS pg_temp._pb_expire_buckets (
      earn_id uuid PRIMARY KEY,
      remaining bigint NOT NULL,
      earned_at timestamptz NOT NULL
    ) ON COMMIT DROP;
    TRUNCATE pg_temp._pb_expire_buckets;

    FOR e IN
      SELECT event_at, event_kind, activity_id, amount, created_at
      FROM (
        SELECT created_at AS event_at, 'earn'::text AS event_kind, id AS activity_id, amount, created_at, id
        FROM public.pawbucks_activity
        WHERE user_id = u.user_id
          AND type = 'earn'
          AND pawbucks_status = 'available'

        UNION ALL

        SELECT expires_at AS event_at, 'expire'::text AS event_kind, id AS activity_id, amount, created_at, id
        FROM public.pawbucks_activity
        WHERE user_id = u.user_id
          AND type = 'earn'
          AND pawbucks_status = 'available'
          AND expires_at IS NOT NULL
          AND expires_at <= now()

        UNION ALL

        SELECT created_at AS event_at, 'redeem'::text AS event_kind, id AS activity_id, amount, created_at, id
        FROM public.pawbucks_activity
        WHERE user_id = u.user_id
          AND type = 'redeem'
          AND source <> 'expiration'
      ) events
      ORDER BY event_at ASC,
        CASE event_kind WHEN 'earn' THEN 1 WHEN 'expire' THEN 2 ELSE 3 END,
        created_at ASC,
        id ASC
    LOOP
      IF e.event_kind = 'earn' THEN
        INSERT INTO pg_temp._pb_expire_buckets (earn_id, remaining, earned_at)
        VALUES (e.activity_id, e.amount, e.created_at)
        ON CONFLICT (earn_id) DO NOTHING;

      ELSIF e.event_kind = 'redeem' THEN
        v_remaining_to_consume := e.amount;
        FOR b IN
          SELECT earn_id, remaining
          FROM pg_temp._pb_expire_buckets
          WHERE remaining > 0
          ORDER BY earned_at ASC, earn_id ASC
        LOOP
          EXIT WHEN v_remaining_to_consume <= 0;
          v_take := LEAST(b.remaining, v_remaining_to_consume);
          UPDATE pg_temp._pb_expire_buckets
          SET remaining = remaining - v_take
          WHERE earn_id = b.earn_id;
          v_remaining_to_consume := v_remaining_to_consume - v_take;
        END LOOP;

      ELSIF e.event_kind = 'expire' THEN
        SELECT earn_id, remaining INTO b
        FROM pg_temp._pb_expire_buckets
        WHERE earn_id = e.activity_id;

        IF FOUND THEN
          UPDATE public.pawbucks_activity
          SET pawbucks_status = 'expired'
          WHERE id = e.activity_id
            AND type = 'earn'
            AND pawbucks_status = 'available';

          IF b.remaining > 0 THEN
            INSERT INTO public.pawbucks_activity (user_id, amount, type, source, description, pawbucks_status, created_at)
            VALUES (
              u.user_id,
              b.remaining::int,
              'redeem',
              'expiration',
              b.remaining || ' PawBucks expired after 60 days',
              'available',
              e.event_at
            );
            v_expired_count := v_expired_count + 1;
          END IF;

          DELETE FROM pg_temp._pb_expire_buckets WHERE earn_id = e.activity_id;
        END IF;
      END IF;
    END LOOP;

    PERFORM public.recompute_pawbucks_wallet(u.user_id);
  END LOOP;

  RETURN v_expired_count;
END;
$$;