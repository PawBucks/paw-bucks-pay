CREATE OR REPLACE FUNCTION public._test_admin_analytics_body()
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE v_total_earned numeric; v_total_spent numeric; result json;
BEGIN
  SELECT COALESCE(SUM(amount),0)::numeric INTO v_total_earned FROM public.pawbucks_activity WHERE type='earn';
  SELECT COALESCE(SUM(ABS(amount)),0)::numeric INTO v_total_spent FROM public.pawbucks_activity WHERE type='redeem';
  SELECT json_build_object(
    'users',(SELECT COUNT(*) FROM public.profiles),
    'merchants',(SELECT COUNT(*) FROM public.merchants),
    'tx',(SELECT COUNT(*) FROM public.transactions WHERE status='completed'),
    'gmv',COALESCE((SELECT SUM(amount) FROM public.transactions WHERE status='completed'),0),
    'rewards',COALESCE((SELECT SUM(rewards_earned) FROM public.transactions WHERE status='completed'),0),
    'fee',COALESCE((SELECT SUM(application_fee) FROM public.transactions WHERE status='completed'),0),
    'earned',v_total_earned,'spent',v_total_spent
  ) INTO result; RETURN result;
END;$$;