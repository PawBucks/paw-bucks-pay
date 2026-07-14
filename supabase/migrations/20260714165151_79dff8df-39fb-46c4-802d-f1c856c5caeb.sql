
-- 1) Restrict get_admin_analytics to admins/superadmins
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
 RETURNS TABLE(total_users bigint, total_merchants bigint, total_transactions bigint, total_gmv numeric, total_rewards numeric, platform_revenue numeric, total_refunded_transactions bigint, total_refunded_amount numeric, total_pawbucks_earned numeric, total_pawbucks_spent numeric, pawbucks_spend_rate numeric, repeat_redemption_rate numeric, repeat_redeemers bigint, total_redeemers bigint)
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

  SELECT COALESCE(SUM(amount), 0) INTO v_total_earned
  FROM pawbucks_activity WHERE type = 'earn';

  SELECT COALESCE(SUM(ABS(amount)), 0) INTO v_total_spent
  FROM pawbucks_activity WHERE type = 'redeem';

  SELECT COUNT(DISTINCT user_id) INTO v_total_redeemers
  FROM pawbucks_activity WHERE type = 'redeem';

  SELECT COUNT(*) INTO v_repeat_redeemers FROM (
    SELECT user_id FROM pawbucks_activity WHERE type = 'redeem'
    GROUP BY user_id HAVING COUNT(*) > 1
  ) r;

  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles)::bigint AS total_users,
    (SELECT COUNT(*) FROM merchants)::bigint AS total_merchants,
    (SELECT COUNT(*) FROM transactions WHERE status = 'completed')::bigint AS total_transactions,
    COALESCE((SELECT SUM(amount_total) FROM transactions WHERE status = 'completed'), 0)::numeric AS total_gmv,
    COALESCE((SELECT SUM(rewards_earned) FROM transactions WHERE status = 'completed'), 0)::numeric AS total_rewards,
    COALESCE((SELECT SUM(platform_fee) FROM transactions WHERE status = 'completed'), 0)::numeric AS platform_revenue,
    (SELECT COUNT(*) FROM transactions WHERE status = 'refunded')::bigint AS total_refunded_transactions,
    COALESCE((SELECT SUM(amount_total) FROM transactions WHERE status = 'refunded'), 0)::numeric AS total_refunded_amount,
    v_total_earned AS total_pawbucks_earned,
    v_total_spent AS total_pawbucks_spent,
    CASE WHEN v_total_earned > 0 THEN ROUND((v_total_spent / v_total_earned) * 100, 2) ELSE 0 END AS pawbucks_spend_rate,
    CASE WHEN v_total_redeemers > 0 THEN ROUND((v_repeat_redeemers::numeric / v_total_redeemers::numeric) * 100, 2) ELSE 0 END AS repeat_redemption_rate,
    v_repeat_redeemers AS repeat_redeemers,
    v_total_redeemers AS total_redeemers;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_admin_analytics() FROM anon;

-- 2) Restrict get_user_access_info to caller's own uid
CREATE OR REPLACE FUNCTION public.get_user_access_info(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL OR p_user_id <> auth.uid() THEN
    RAISE EXCEPTION 'Not authorized' USING ERRCODE = '42501';
  END IF;

  RETURN (
    SELECT jsonb_build_object(
      'user_type', (SELECT user_type FROM profiles WHERE id = p_user_id),
      'system_roles', COALESCE(
        (SELECT jsonb_agg(role) FROM user_roles WHERE user_id = p_user_id),
        '[]'::jsonb
      ),
      'is_merchant', EXISTS(SELECT 1 FROM merchants WHERE user_id = p_user_id),
      'is_vet', EXISTS(SELECT 1 FROM partner_vets WHERE user_id = p_user_id),
      'has_pets', EXISTS(SELECT 1 FROM pet_profiles WHERE user_id = p_user_id),
      'has_shared_pets', EXISTS(
        SELECT 1 FROM shared_account_members sam
        JOIN pet_profiles pp ON pp.user_id = sam.owner_id
        WHERE sam.member_id = p_user_id AND sam.status = 'accepted'
      )
    )
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.get_user_access_info(uuid) FROM anon;

-- 3) Restrict accountant_invitations.access_token from client reads
REVOKE SELECT ON public.accountant_invitations FROM anon, authenticated;
GRANT SELECT (
  id,
  merchant_id,
  accountant_email,
  accountant_name,
  status,
  permissions,
  invited_at,
  accepted_at,
  expires_at,
  last_accessed_at,
  created_at,
  updated_at
) ON public.accountant_invitations TO authenticated;
GRANT SELECT ON public.accountant_invitations TO service_role;
