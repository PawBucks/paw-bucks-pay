CREATE OR REPLACE FUNCTION public.get_admin_analytics()
 RETURNS TABLE(total_users bigint, total_merchants bigint, total_transactions bigint, total_gmv numeric, total_rewards numeric, platform_revenue numeric, total_refunded_transactions bigint, total_refunded_amount numeric, total_pawbucks_earned numeric, total_pawbucks_spent numeric, pawbucks_spend_rate numeric, repeat_redemption_rate numeric, repeat_redeemers bigint, total_redeemers bigint, cross_merchant_redemption_rate numeric, cross_merchant_redeemed_pb numeric, attributed_redeemed_pb numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_repeat_redeemers bigint;
  v_total_redeemers bigint;
  v_total_earned numeric;
  v_total_spent numeric;
  v_cross_pb numeric := 0;
  v_attributed_pb numeric := 0;
  r record;
  redeem_row record;
  earn_merchants uuid[];
  earn_remaining bigint[];
  earn_times timestamptz[];
  i int;
  remaining bigint;
  take bigint;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(amount), 0)::numeric INTO v_total_earned
  FROM public.pawbucks_activity WHERE type = 'earn';

  SELECT COALESCE(SUM(ABS(amount)), 0)::numeric INTO v_total_spent
  FROM public.pawbucks_activity WHERE type = 'redeem';

  WITH redeemer_first_spend AS (
    SELECT user_id, MIN(created_at) AS first_spend_at
    FROM public.pawbucks_activity WHERE type = 'redeem' GROUP BY user_id
  ),
  redeemers_with_return AS (
    SELECT rfs.user_id FROM redeemer_first_spend rfs
    WHERE EXISTS (
      SELECT 1 FROM public.transactions t
      WHERE t.user_id = rfs.user_id AND t.status = 'completed'
        AND t.created_at > rfs.first_spend_at
    )
  )
  SELECT (SELECT COUNT(*) FROM redeemers_with_return),
         (SELECT COUNT(*) FROM redeemer_first_spend)
  INTO v_repeat_redeemers, v_total_redeemers;

  -- CMRR via in-memory arrays (no temp table, so it runs in read-only tx)
  FOR r IN
    SELECT DISTINCT a.user_id
    FROM public.pawbucks_activity a
    LEFT JOIN public.transactions t ON t.id = a.transaction_id
    WHERE a.type = 'redeem' AND COALESCE(a.partner_id, t.merchant_id) IS NOT NULL
  LOOP
    SELECT
      COALESCE(array_agg(COALESCE(a.partner_id, t.merchant_id) ORDER BY a.created_at, a.id), ARRAY[]::uuid[]),
      COALESCE(array_agg(a.amount ORDER BY a.created_at, a.id), ARRAY[]::bigint[]),
      COALESCE(array_agg(a.created_at ORDER BY a.created_at, a.id), ARRAY[]::timestamptz[])
    INTO earn_merchants, earn_remaining, earn_times
    FROM public.pawbucks_activity a
    LEFT JOIN public.transactions t ON t.id = a.transaction_id
    WHERE a.user_id = r.user_id AND a.type = 'earn';

    FOR redeem_row IN
      SELECT ABS(a.amount) AS redeem_amount, a.created_at,
             COALESCE(a.partner_id, t.merchant_id) AS redeem_merchant
      FROM public.pawbucks_activity a
      LEFT JOIN public.transactions t ON t.id = a.transaction_id
      WHERE a.user_id = r.user_id AND a.type = 'redeem'
      ORDER BY a.created_at ASC, a.id ASC
    LOOP
      IF redeem_row.redeem_merchant IS NULL THEN CONTINUE; END IF;
      remaining := redeem_row.redeem_amount;
      i := 1;
      WHILE remaining > 0 AND i <= array_length(earn_remaining, 1) LOOP
        IF earn_remaining[i] > 0 AND earn_times[i] <= redeem_row.created_at THEN
          take := LEAST(remaining, earn_remaining[i]);
          IF earn_merchants[i] IS NOT NULL THEN
            v_attributed_pb := v_attributed_pb + take;
            IF earn_merchants[i] <> redeem_row.redeem_merchant THEN
              v_cross_pb := v_cross_pb + take;
            END IF;
          END IF;
          earn_remaining[i] := earn_remaining[i] - take;
          remaining := remaining - take;
        END IF;
        IF earn_remaining[i] = 0 OR earn_times[i] > redeem_row.created_at THEN
          i := i + 1;
        END IF;
      END LOOP;
    END LOOP;
  END LOOP;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles)::bigint,
    (SELECT COUNT(*) FROM public.merchants)::bigint,
    (SELECT COUNT(*) FROM public.transactions WHERE status IN ('completed','partially_refunded'))::bigint,
    COALESCE((SELECT SUM(amount - COALESCE(amount_refunded, 0)) FROM public.transactions WHERE status IN ('completed','partially_refunded')), 0)::numeric,
    COALESCE((SELECT SUM(rewards_earned) FROM public.transactions WHERE status IN ('completed','partially_refunded')), 0)::numeric,
    COALESCE((SELECT SUM(application_fee) FROM public.transactions WHERE status IN ('completed','partially_refunded')), 0)::numeric,
    (SELECT COUNT(*) FROM public.transactions WHERE status IN ('refunded','partially_refunded'))::bigint,
    COALESCE((SELECT SUM(CASE WHEN COALESCE(amount_refunded, 0) > 0 THEN amount_refunded ELSE amount END)
              FROM public.transactions WHERE status IN ('refunded','partially_refunded')), 0)::numeric,
    v_total_earned,
    v_total_spent,
    CASE WHEN v_total_earned > 0 THEN ROUND((v_total_spent / v_total_earned) * 100, 2) ELSE 0 END,
    CASE WHEN v_total_redeemers > 0 THEN ROUND((v_repeat_redeemers::numeric / v_total_redeemers::numeric) * 100, 2) ELSE 0 END,
    v_repeat_redeemers,
    v_total_redeemers,
    CASE WHEN v_attributed_pb > 0 THEN ROUND((v_cross_pb / v_attributed_pb) * 100, 2) ELSE 0 END,
    v_cross_pb,
    v_attributed_pb;
END;
$function$;