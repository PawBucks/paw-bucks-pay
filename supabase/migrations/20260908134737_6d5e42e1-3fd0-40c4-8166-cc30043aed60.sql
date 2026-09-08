GRANT EXECUTE ON FUNCTION public.user_participates_in_campaign(uuid, uuid) TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_admin_analytics()
 RETURNS TABLE(total_users bigint, total_merchants bigint, total_transactions bigint, total_gmv numeric, total_rewards numeric, platform_revenue numeric, total_refunded_transactions bigint, total_refunded_amount numeric, total_pawbucks_earned numeric, total_pawbucks_spent numeric, pawbucks_spend_rate numeric, repeat_redemption_rate numeric, repeat_redeemers bigint, total_redeemers bigint, cross_merchant_redemption_rate numeric, cross_merchant_redeemed_pb numeric, attributed_redeemed_pb numeric, pawpass_subscribers bigint, pawpass_plus_subscribers bigint, subscription_mrr numeric, merchant_services_revenue numeric, merchant_services_active bigint, branded_campaign_revenue numeric, branded_campaign_delivered_usd numeric, marketplace_revenue numeric, marketplace_orders bigint, branded_campaign_committed_usd numeric)
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
  v_camp_committed numeric := 0;
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

  SELECT
    COUNT(*) FILTER (WHERE lower(subscription_tier) IN ('pawpass','basic')),
    COUNT(*) FILTER (WHERE lower(subscription_tier) IN ('pawpass_plus','pawpass+','plus'))
  INTO v_pawpass, v_pawpass_plus
  FROM public.subscriptions
  WHERE status IN ('active','trialing')
    AND COALESCE(is_manual_upgrade, false) = false
    AND stripe_subscription_id IS NOT NULL
    AND stripe_subscription_id <> ''
    AND (expires_at IS NULL OR expires_at > now());

  v_mrr := (v_pawpass * 10) + (v_pawpass_plus * 20);

  -- Merchant premium services: only purchases with a processed Stripe payment.
  -- The active-plan count uses the same Stripe-paid population as the revenue.
  SELECT
    COALESCE(SUM(COALESCE(p.amount_paid_usd, 0)), 0)::numeric,
    COUNT(*) FILTER (WHERE p.status = 'active')
  INTO v_svc_rev, v_svc_active
  FROM public.merchant_service_purchases p
  WHERE p.stripe_payment_intent_id IS NOT NULL
    AND p.stripe_payment_intent_id <> ''
    AND COALESCE(p.amount_paid_usd, 0) > 0;

  SELECT
    COALESCE(SUM(o.stripe_amount_usd), 0)::numeric,
    COUNT(*)
  INTO v_mkt_rev, v_mkt_orders
  FROM public.pet_store_orders o
  WHERE o.stripe_payment_intent_id IS NOT NULL
    AND o.stripe_payment_intent_id <> ''
    AND COALESCE(o.stripe_amount_usd, 0) > 0
    AND COALESCE(o.status, 'completed') NOT IN ('cancelled','refunded','failed','pending');

  SELECT COALESCE(SUM(budget_usd), 0)::numeric,
         COALESCE(SUM(total_redeemed), 0)::numeric
  INTO v_camp_committed, v_camp_redeemed_pb
  FROM public.brand_campaigns
  WHERE status NOT IN ('draft', 'cancelled');

  SELECT
    COALESCE((
      SELECT SUM(c.budget_usd) FROM public.brand_campaigns c
      WHERE c.status NOT IN ('draft','cancelled')
        AND c.stripe_payment_intent_id IS NOT NULL
        AND c.stripe_payment_intent_id <> ''
    ), 0)
    +
    COALESCE((
      SELECT SUM(ap.amount) FROM public.admin_invoice_payments ap
      WHERE ap.invoice_id IN (
        SELECT c.admin_invoice_id FROM public.brand_campaigns c
        WHERE c.admin_invoice_id IS NOT NULL
          AND c.status NOT IN ('draft','cancelled')
          AND (c.stripe_payment_intent_id IS NULL OR c.stripe_payment_intent_id = '')
      )
    ), 0)
  INTO v_camp_rev;

  SELECT COALESCE(SUM(spend_usd), 0)::numeric INTO v_camp_delivered_stats
  FROM public.brand_campaign_daily_stats;

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
    v_mkt_orders,
    v_camp_committed;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated, service_role;
