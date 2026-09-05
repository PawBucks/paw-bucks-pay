DROP FUNCTION IF EXISTS public.get_admin_analytics();

CREATE OR REPLACE FUNCTION public.get_admin_analytics()
 RETURNS TABLE(total_users bigint, total_merchants bigint, total_transactions bigint, total_gmv numeric, total_rewards numeric, platform_revenue numeric, total_refunded_transactions bigint, total_refunded_amount numeric, total_pawbucks_earned numeric, total_pawbucks_spent numeric, pawbucks_spend_rate numeric, repeat_redemption_rate numeric, repeat_redeemers bigint, total_redeemers bigint, cross_merchant_redemption_rate numeric, cross_merchant_redeemed_pb numeric, attributed_redeemed_pb numeric, pawpass_subscribers bigint, pawpass_plus_subscribers bigint, subscription_mrr numeric, merchant_services_revenue numeric, merchant_services_active bigint, branded_campaign_revenue numeric, branded_campaign_delivered_usd numeric, marketplace_revenue numeric, marketplace_orders bigint)
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
  v_pawpass bigint := 0;
  v_pawpass_plus bigint := 0;
  v_mrr numeric := 0;
  v_svc_rev numeric := 0;
  v_svc_active bigint := 0;
  v_camp_rev numeric := 0;
  v_camp_delivered numeric := 0;
  v_camp_delivered_stats numeric := 0;
  v_camp_redeemed_pb numeric := 0;
  v_mkt_rev numeric := 0;
  v_mkt_orders bigint := 0;
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

  -- Subscription revenue (PawPass $10/mo, PawPass+ $20/mo).
  -- Count every membership currently marked active/trialing; manual upgrades
  -- stop counting once their expiry passes.
  SELECT
    COUNT(*) FILTER (WHERE lower(subscription_tier) IN ('pawpass','basic')),
    COUNT(*) FILTER (WHERE lower(subscription_tier) IN ('pawpass_plus','pawpass+','plus'))
  INTO v_pawpass, v_pawpass_plus
  FROM public.subscriptions
  WHERE status IN ('active','trialing')
    AND (expires_at IS NULL OR expires_at > now());

  v_mrr := (v_pawpass * 10) + (v_pawpass_plus * 20);

  -- Merchant premium services revenue.
  -- Some purchase rows were written without amounts; fall back to the service
  -- list price so real sales are never reported as $0. PawBucks-paid purchases
  -- are converted at 1 PB = $0.001.
  SELECT
    COALESCE(SUM(
      CASE
        WHEN COALESCE(p.amount_paid_usd, 0) > 0 THEN p.amount_paid_usd
        WHEN COALESCE(p.amount_paid_pawbucks, 0) > 0 THEN p.amount_paid_pawbucks * 0.001
        WHEN COALESCE(s.price_usd, 0) > 0 THEN s.price_usd
        ELSE COALESCE(s.price_pawbucks, 0) * 0.001
      END
    ), 0)::numeric,
    COUNT(*) FILTER (WHERE p.status = 'active')
  INTO v_svc_rev, v_svc_active
  FROM public.merchant_service_purchases p
  LEFT JOIN public.merchant_market_services s ON s.id = p.service_id;

  -- PawBucks Marketplace (pet store) sales.
  -- Line items are valued from the catalog: USD price is stored in cents,
  -- PawBucks price converts at 1 PB = $0.001. Cancelled/refunded orders excluded.
  SELECT
    COALESCE(SUM(
      oi.quantity * CASE
        WHEN COALESCE(it.price, 0) > 0 THEN it.price / 100.0
        ELSE COALESCE(it.price_pawbucks, oi.price_per_item, 0) * 0.001
      END
    ), 0)::numeric,
    COUNT(DISTINCT o.id)
  INTO v_mkt_rev, v_mkt_orders
  FROM public.pet_store_orders o
  JOIN public.pet_store_order_items oi ON oi.order_id = o.id
  LEFT JOIN public.pet_store_items it ON it.id = oi.item_id
  WHERE COALESCE(o.status, 'completed') NOT IN ('cancelled','refunded','failed','pending');

  -- Branded PawBucks campaign revenue (committed budgets)
  SELECT COALESCE(SUM(budget_usd), 0)::numeric,
         COALESCE(SUM(total_redeemed), 0)::numeric
  INTO v_camp_rev, v_camp_redeemed_pb
  FROM public.brand_campaigns
  WHERE status NOT IN ('draft', 'cancelled');

  SELECT COALESCE(SUM(spend_usd), 0)::numeric INTO v_camp_delivered_stats
  FROM public.brand_campaign_daily_stats;

  -- Prefer rolled-up daily spend, but fall back to actual redeemed campaign
  -- PawBucks when the aggregation has not run yet.
  v_camp_delivered := GREATEST(v_camp_delivered_stats, v_camp_redeemed_pb * 0.001);

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
  WITH active AS (
    SELECT
      amount,
      COALESCE(amount_refunded, 0) AS refunded,
      COALESCE(rewards_earned, 0) AS rewards_earned,
      COALESCE(application_fee, 0) AS application_fee,
      CASE
        WHEN COALESCE(amount, 0) > 0
          THEN GREATEST(0, LEAST(1, 1 - (COALESCE(amount_refunded, 0) / amount)))
        ELSE 1
      END AS keep_ratio
    FROM public.transactions
    WHERE status IN ('completed','partially_refunded')
  )
  SELECT
    (SELECT COUNT(*) FROM public.profiles)::bigint,
    (SELECT COUNT(*) FROM public.merchants)::bigint,
    (SELECT COUNT(*) FROM active)::bigint,
    COALESCE((SELECT SUM(amount - refunded) FROM active), 0)::numeric,
    COALESCE((SELECT SUM(rewards_earned * keep_ratio) FROM active), 0)::numeric,
    COALESCE((SELECT SUM(application_fee * keep_ratio) FROM active), 0)::numeric,
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
    v_attributed_pb,
    v_pawpass,
    v_pawpass_plus,
    v_mrr,
    v_svc_rev,
    v_svc_active,
    v_camp_rev,
    v_camp_delivered,
    v_mkt_rev,
    v_mkt_orders;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO service_role;