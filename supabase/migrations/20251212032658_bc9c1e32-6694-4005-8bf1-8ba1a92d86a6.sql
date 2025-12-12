-- Update get_admin_analytics to use rewards_earned instead of cashback_earned
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
 RETURNS TABLE(total_users bigint, total_merchants bigint, total_transactions bigint, total_gmv numeric, total_cashback_distributed numeric)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE user_type = 'pet_owner') as total_users,
    (SELECT COUNT(*) FROM merchants) as total_merchants,
    (SELECT COUNT(*) FROM transactions) as total_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'completed'), 0) as total_gmv,
    COALESCE((SELECT SUM(rewards_earned) FROM transactions WHERE status = 'completed'), 0) as total_cashback_distributed;
$function$;