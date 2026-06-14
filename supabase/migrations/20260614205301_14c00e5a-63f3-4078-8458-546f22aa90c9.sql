
-- 1. Rewrite credit_branded_pawbucks to stop mirroring branded PB into the
--    general spendable wallet. Branded PB now live exclusively in the
--    per-campaign branded_pawbucks_ledger and can only be spent via
--    redeem_branded_pawbucks_v2 (which enforces the brand product gate).
CREATE OR REPLACE FUNCTION public.credit_branded_pawbucks(
  p_campaign_id uuid,
  p_user_id uuid,
  p_merchant_id uuid,
  p_checkin_id uuid,
  p_amount integer,
  p_description text,
  p_brand_name text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_activity_id uuid;
  v_already boolean := false;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  BEGIN
    INSERT INTO public.branded_pawbucks_activity
      (campaign_id, user_id, type, amount, merchant_id, checkin_id, description)
    VALUES
      (p_campaign_id, p_user_id, 'earn', p_amount, p_merchant_id, p_checkin_id, p_description)
    RETURNING id INTO v_activity_id;
  EXCEPTION WHEN unique_violation THEN
    v_already := true;
  END;

  IF v_already THEN
    RETURN jsonb_build_object('success', false, 'already_credited', true);
  END IF;

  INSERT INTO public.branded_pawbucks_ledger (campaign_id, user_id, balance, total_earned)
  VALUES (p_campaign_id, p_user_id, p_amount, p_amount)
  ON CONFLICT (campaign_id, user_id) DO UPDATE
    SET balance = public.branded_pawbucks_ledger.balance + EXCLUDED.balance,
        total_earned = public.branded_pawbucks_ledger.total_earned + EXCLUDED.total_earned;

  -- NOTE: Intentionally NOT mirroring into public.pawbucks_wallet or
  -- public.pawbucks_activity. Branded PawBucks must only be spendable on
  -- the funding brand's products via redeem_branded_pawbucks_v2.

  UPDATE public.brand_campaigns
  SET total_distributed = COALESCE(total_distributed, 0) + p_amount,
      total_checkins    = COALESCE(total_checkins, 0) + 1
  WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'activity_id', v_activity_id,
    'amount', p_amount
  );
END;
$function$;

-- 2. Backfill: subtract still-outstanding branded balances from each user's
--    general spendable wallet so historical mirrored amounts are removed.
--    Floor at zero — never push a wallet negative.
WITH outstanding AS (
  SELECT user_id, SUM(balance)::int AS branded_balance
    FROM public.branded_pawbucks_ledger
   WHERE balance > 0
   GROUP BY user_id
)
UPDATE public.pawbucks_wallet w
   SET balance = GREATEST(0, w.balance - o.branded_balance),
       last_updated = now()
  FROM outstanding o
 WHERE w.user_id = o.user_id;
