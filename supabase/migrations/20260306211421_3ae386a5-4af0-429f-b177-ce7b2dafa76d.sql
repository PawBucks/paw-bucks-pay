
DROP FUNCTION IF EXISTS public.get_admin_analytics();

CREATE OR REPLACE FUNCTION public.get_admin_analytics()
 RETURNS TABLE(total_users bigint, total_merchants bigint, total_transactions bigint, total_gmv numeric, total_rewards numeric, platform_revenue numeric, total_refunded_transactions bigint, total_refunded_amount numeric, total_pawbucks_earned numeric, total_pawbucks_spent numeric, pawbucks_spend_rate numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM merchants) as total_merchants,
    (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as total_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'completed'), 0) as total_gmv,
    COALESCE((SELECT SUM(COALESCE(cashback_earned, 0) + COALESCE(rewards_earned, 0)) FROM transactions WHERE status = 'completed'), 0) as total_rewards,
    COALESCE((SELECT SUM(COALESCE(application_fee, 0)) FROM transactions WHERE status = 'completed'), 0) as platform_revenue,
    (SELECT COUNT(*) FROM transactions WHERE status = 'refunded') as total_refunded_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'refunded'), 0) as total_refunded_amount,
    COALESCE((SELECT SUM(amount) FROM pawbucks_activity WHERE type = 'credit'), 0)::numeric as total_pawbucks_earned,
    COALESCE((SELECT SUM(ABS(amount)) FROM pawbucks_activity WHERE type = 'debit'), 0)::numeric as total_pawbucks_spent,
    CASE 
      WHEN COALESCE((SELECT SUM(amount) FROM pawbucks_activity WHERE type = 'credit'), 0) > 0
      THEN ROUND(
        (COALESCE((SELECT SUM(ABS(amount)) FROM pawbucks_activity WHERE type = 'debit'), 0)::numeric /
         COALESCE((SELECT SUM(amount) FROM pawbucks_activity WHERE type = 'credit'), 0)::numeric) * 100,
        1
      )
      ELSE 0
    END as pawbucks_spend_rate;
END;
$function$;
