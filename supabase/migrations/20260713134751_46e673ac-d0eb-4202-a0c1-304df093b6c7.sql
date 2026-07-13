-- Fix PawBucks ledger chronology: a transaction's redemption must be applied
-- before the PawBucks earned by that same transaction.

-- 1) Link historical transaction-tied ledger rows that were created near their
-- matching transaction but did not store transaction_id. This lets wallet
-- recomputation order same-transaction redeem rows before earn rows.
WITH candidate_links AS (
  SELECT
    pa.id AS activity_id,
    t.id AS transaction_id,
    row_number() OVER (
      PARTITION BY pa.id
      ORDER BY abs(extract(epoch FROM (pa.created_at - t.created_at))) ASC, t.created_at DESC
    ) AS rn
  FROM public.pawbucks_activity pa
  JOIN public.transactions t
    ON t.user_id = pa.user_id
   AND t.merchant_id = pa.partner_id
   AND t.status IN ('completed', 'refunded')
   AND pa.created_at BETWEEN t.created_at - interval '3 minutes'
                         AND t.created_at + interval '3 minutes'
  WHERE pa.transaction_id IS NULL
    AND pa.type IN ('earn', 'redeem')
    AND pa.source <> 'expiration'
    AND lower(pa.source) IN (
      'subscription purchase',
      'subscription_payment',
      'subscription_renewal',
      'invoice payment',
      'invoice_payment',
      'direct_payment',
      'transaction'
    )
)
UPDATE public.pawbucks_activity pa
SET transaction_id = cl.transaction_id
FROM candidate_links cl
WHERE cl.rn = 1
  AND pa.id = cl.activity_id;

-- 2) Recompute from the ledger using transaction-aware ordering.
CREATE OR REPLACE FUNCTION public.recompute_pawbucks_wallet(p_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
$function$;

-- 3) Keep the expiration job consistent with the same transaction-aware order.
CREATE OR REPLACE FUNCTION public.expire_pawbucks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
        SELECT
          COALESCE(t.created_at, pa.created_at) AS event_at,
          'earn'::text AS event_kind,
          pa.id AS activity_id,
          pa.amount,
          pa.created_at,
          pa.id
        FROM public.pawbucks_activity pa
        LEFT JOIN public.transactions t ON t.id = pa.transaction_id
        WHERE pa.user_id = u.user_id
          AND pa.type = 'earn'
          AND pa.pawbucks_status = 'available'

        UNION ALL

        SELECT
          pa.expires_at AS event_at,
          'expire'::text AS event_kind,
          pa.id AS activity_id,
          pa.amount,
          pa.created_at,
          pa.id
        FROM public.pawbucks_activity pa
        WHERE pa.user_id = u.user_id
          AND pa.type = 'earn'
          AND pa.pawbucks_status = 'available'
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
        WHERE pa.user_id = u.user_id
          AND pa.type = 'redeem'
          AND pa.source <> 'expiration'
      ) events
      ORDER BY event_at ASC,
        CASE event_kind WHEN 'expire' THEN 1 WHEN 'redeem' THEN 2 WHEN 'earn' THEN 3 ELSE 4 END,
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
$function$;

-- 4) Rebalance every existing Pet Owner wallet from the corrected ledger.
DO $$
DECLARE
  u uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.user_type = 'pet_owner'
      AND (
        EXISTS (SELECT 1 FROM public.pawbucks_activity pa WHERE pa.user_id = p.id)
        OR EXISTS (SELECT 1 FROM public.pawbucks_wallet pw WHERE pw.user_id = p.id)
      )
  LOOP
    PERFORM public.recompute_pawbucks_wallet(u);
  END LOOP;
END $$;