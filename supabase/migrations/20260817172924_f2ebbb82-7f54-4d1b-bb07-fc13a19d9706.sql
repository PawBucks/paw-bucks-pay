-- 1. checkins: only the token-validating process_checkin routine may create check-ins
DROP POLICY IF EXISTS "Authenticated users can create check-ins" ON public.checkins;
REVOKE INSERT ON public.checkins FROM authenticated, anon;

-- 2. pawbucks_activity: remove client-side earn insert path
DROP POLICY IF EXISTS "Users can insert own provisional checkin activity" ON public.pawbucks_activity;
REVOKE INSERT ON public.pawbucks_activity FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.submit_checkin_purchase(
  p_followup_id uuid,
  p_spend_amount numeric,
  p_pawbucks_used integer DEFAULT 0
)
RETURNS TABLE(success boolean, pawbucks integer, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_user uuid := auth.uid();
  v_followup RECORD;
  v_tier text;
  v_rate integer := 10;
  v_amount numeric;
  v_pb integer;
  v_pb_used integer := GREATEST(COALESCE(p_pawbucks_used, 0), 0);
BEGIN
  IF v_user IS NULL THEN
    RETURN QUERY SELECT FALSE, 0, 'Not authenticated'::text;
    RETURN;
  END IF;

  SELECT * INTO v_followup
  FROM checkin_followups
  WHERE id = p_followup_id AND user_id = v_user;

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'Check-in follow-up not found'::text;
    RETURN;
  END IF;

  IF v_followup.status <> 'notified' THEN
    RETURN QUERY SELECT FALSE, 0, 'This visit has already been answered'::text;
    RETURN;
  END IF;

  v_amount := COALESCE(p_spend_amount, 0);
  IF v_amount <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Please enter a valid amount'::text;
    RETURN;
  END IF;
  -- hard sanity cap on self-reported spend
  IF v_amount > 5000 THEN
    v_amount := 5000;
  END IF;

  SELECT s.subscription_tier INTO v_tier
  FROM subscriptions s
  WHERE s.user_id = v_user
    AND s.status = 'active'
    AND (s.current_period_end IS NULL OR s.current_period_end > now())
  ORDER BY s.current_period_end DESC NULLS LAST
  LIMIT 1;

  IF v_tier = 'pawpass_plus' THEN
    v_rate := 30;
  ELSIF v_tier = 'pawpass' THEN
    v_rate := 20;
  END IF;

  v_pb := FLOOR(v_amount * v_rate)::integer;
  IF v_pb <= 0 THEN
    RETURN QUERY SELECT FALSE, 0, 'Nothing to credit'::text;
    RETURN;
  END IF;

  UPDATE checkin_followups
  SET status = 'answered', response = 'yes', answered_at = now()
  WHERE id = p_followup_id AND user_id = v_user AND status = 'notified';

  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'This visit has already been answered'::text;
    RETURN;
  END IF;

  INSERT INTO pawbucks_activity (
    user_id, type, amount, source, partner_id, description, pawbucks_status, vest_date
  ) VALUES (
    v_user,
    'earn',
    v_pb,
    'checkin_provisional',
    v_followup.merchant_id,
    'Provisional credit — ' || COALESCE(v_followup.entity_name, 'Merchant') || ' ($' || to_char(v_amount, 'FM999999990.00') || CASE WHEN v_pb_used > 0 THEN ' | ' || v_pb_used || ' PB redeemed' ELSE '' END || ')',
    'pending',
    now() + interval '72 hours'
  );

  RETURN QUERY SELECT TRUE, v_pb, 'Provisional credit issued'::text;
END;
$function$;

REVOKE ALL ON FUNCTION public.submit_checkin_purchase(uuid, numeric, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_checkin_purchase(uuid, numeric, integer) TO authenticated;

-- 3. guilt_badge_rewards: only allow marking a reward used; immutable value/expiry
DROP POLICY IF EXISTS "Users can update their own rewards" ON public.guilt_badge_rewards;
CREATE POLICY "Users can mark their own rewards used"
ON public.guilt_badge_rewards
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND status <> 'used')
WITH CHECK (
  auth.uid() = user_id
  AND status = 'used'
  AND used_at IS NOT NULL
);

CREATE OR REPLACE FUNCTION public.guilt_badge_rewards_lock_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin_or_service() THEN
    RETURN NEW;
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.badge_id := OLD.badge_id;
  NEW.user_badge_id := OLD.user_badge_id;
  NEW.reward_type := OLD.reward_type;
  NEW.reward_value := OLD.reward_value;
  NEW.reward_code := OLD.reward_code;
  NEW.expires_at := OLD.expires_at;
  NEW.created_at := OLD.created_at;

  IF OLD.status = 'used' THEN
    RAISE EXCEPTION 'This reward has already been used';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_guilt_badge_rewards_lock_fields ON public.guilt_badge_rewards;
CREATE TRIGGER trg_guilt_badge_rewards_lock_fields
BEFORE UPDATE ON public.guilt_badge_rewards
FOR EACH ROW EXECUTE FUNCTION public.guilt_badge_rewards_lock_fields();

-- 4. user_badge_promotions: only forward is_used transition
DROP POLICY IF EXISTS "Users can update their own badge promotions" ON public.user_badge_promotions;
CREATE POLICY "Users can consume their own badge promotions"
ON public.user_badge_promotions
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id AND COALESCE(is_used, false) = false)
WITH CHECK (auth.uid() = user_id AND is_used = true AND used_at IS NOT NULL);

CREATE OR REPLACE FUNCTION public.user_badge_promotions_lock_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  IF public.is_admin_or_service() THEN
    RETURN NEW;
  END IF;

  NEW.user_id := OLD.user_id;
  NEW.promotion_id := OLD.promotion_id;
  NEW.user_badge_id := OLD.user_badge_id;
  NEW.activated_at := OLD.activated_at;
  NEW.expires_at := OLD.expires_at;

  IF COALESCE(OLD.is_used, false) = true THEN
    RAISE EXCEPTION 'This promotion has already been used';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_user_badge_promotions_lock_fields ON public.user_badge_promotions;
CREATE TRIGGER trg_user_badge_promotions_lock_fields
BEFORE UPDATE ON public.user_badge_promotions
FOR EACH ROW EXECUTE FUNCTION public.user_badge_promotions_lock_fields();