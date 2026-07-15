CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS TABLE(
  total_users bigint,
  total_merchants bigint,
  total_transactions bigint,
  total_gmv numeric,
  total_rewards numeric,
  platform_revenue numeric,
  total_refunded_transactions bigint,
  total_refunded_amount numeric,
  total_pawbucks_earned numeric,
  total_pawbucks_spent numeric,
  pawbucks_spend_rate numeric,
  repeat_redemption_rate numeric,
  repeat_redeemers bigint,
  total_redeemers bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_repeat_redeemers bigint;
  v_total_redeemers bigint;
  v_total_earned numeric;
  v_total_spent numeric;
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'superadmin'::app_role)
  ) THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  SELECT COALESCE(SUM(amount), 0)::numeric INTO v_total_earned
  FROM public.pawbucks_activity
  WHERE type = 'earn';

  SELECT COALESCE(SUM(ABS(amount)), 0)::numeric INTO v_total_spent
  FROM public.pawbucks_activity
  WHERE type = 'redeem';

  WITH redeemer_first_spend AS (
    SELECT user_id, MIN(created_at) AS first_spend_at
    FROM public.pawbucks_activity
    WHERE type = 'redeem'
    GROUP BY user_id
  ),
  redeemers_with_return AS (
    SELECT rfs.user_id
    FROM redeemer_first_spend rfs
    WHERE EXISTS (
      SELECT 1
      FROM public.transactions t
      WHERE t.user_id = rfs.user_id
        AND t.status = 'completed'
        AND t.created_at > rfs.first_spend_at
    )
  )
  SELECT
    (SELECT COUNT(*) FROM redeemers_with_return),
    (SELECT COUNT(*) FROM redeemer_first_spend)
  INTO v_repeat_redeemers, v_total_redeemers;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM public.profiles)::bigint AS total_users,
    (SELECT COUNT(*) FROM public.merchants)::bigint AS total_merchants,
    (SELECT COUNT(*) FROM public.transactions WHERE status = 'completed')::bigint AS total_transactions,
    COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status = 'completed'), 0)::numeric AS total_gmv,
    COALESCE((SELECT SUM(rewards_earned) FROM public.transactions WHERE status = 'completed'), 0)::numeric AS total_rewards,
    COALESCE((SELECT SUM(application_fee) FROM public.transactions WHERE status = 'completed'), 0)::numeric AS platform_revenue,
    (SELECT COUNT(*) FROM public.transactions WHERE status = 'refunded')::bigint AS total_refunded_transactions,
    COALESCE((SELECT SUM(COALESCE(amount_refunded, amount)) FROM public.transactions WHERE status = 'refunded'), 0)::numeric AS total_refunded_amount,
    v_total_earned AS total_pawbucks_earned,
    v_total_spent AS total_pawbucks_spent,
    CASE WHEN v_total_earned > 0 THEN ROUND((v_total_spent / v_total_earned) * 100, 2) ELSE 0 END AS pawbucks_spend_rate,
    CASE WHEN v_total_redeemers > 0 THEN ROUND((v_repeat_redeemers::numeric / v_total_redeemers::numeric) * 100, 2) ELSE 0 END AS repeat_redemption_rate,
    v_repeat_redeemers AS repeat_redeemers,
    v_total_redeemers AS total_redeemers;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_admin_analytics() FROM anon;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_admin_analytics() TO service_role;