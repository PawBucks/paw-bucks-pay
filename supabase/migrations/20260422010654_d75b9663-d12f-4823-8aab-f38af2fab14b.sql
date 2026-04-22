-- Add trigger configuration to brand_campaigns
ALTER TABLE public.brand_campaigns
  ADD COLUMN IF NOT EXISTS trigger_type text NOT NULL DEFAULT 'checkin',
  ADD COLUMN IF NOT EXISTS min_purchase_usd numeric(10,2) NOT NULL DEFAULT 0;

-- Validation trigger (avoid CHECK on text for flexibility)
CREATE OR REPLACE FUNCTION public.validate_brand_campaign_trigger()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.trigger_type NOT IN ('checkin', 'checkout', 'both') THEN
    RAISE EXCEPTION 'Invalid trigger_type %, must be checkin, checkout, or both', NEW.trigger_type;
  END IF;
  IF NEW.min_purchase_usd < 0 THEN
    RAISE EXCEPTION 'min_purchase_usd cannot be negative';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validate_brand_campaign_trigger_tg ON public.brand_campaigns;
CREATE TRIGGER validate_brand_campaign_trigger_tg
  BEFORE INSERT OR UPDATE OF trigger_type, min_purchase_usd ON public.brand_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.validate_brand_campaign_trigger();

-- Admin RPC: update campaign parameters
CREATE OR REPLACE FUNCTION public.admin_update_brand_campaign(
  p_campaign_id uuid,
  p_updates jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
  v_campaign record;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin AND role IN ('admin','superadmin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  SELECT * INTO v_campaign FROM public.brand_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
  END IF;

  UPDATE public.brand_campaigns SET
    pawbucks_per_checkin   = COALESCE((p_updates->>'pawbucks_per_checkin')::int, pawbucks_per_checkin),
    daily_spend_cap        = COALESCE(NULLIF(p_updates->>'daily_spend_cap','')::numeric, daily_spend_cap),
    trigger_type           = COALESCE(p_updates->>'trigger_type', trigger_type),
    min_purchase_usd       = COALESCE((p_updates->>'min_purchase_usd')::numeric, min_purchase_usd),
    end_date               = COALESCE(NULLIF(p_updates->>'end_date','')::timestamptz, end_date),
    pawbucks_pool          = COALESCE((p_updates->>'pawbucks_pool')::int, pawbucks_pool),
    budget_usd             = COALESCE((p_updates->>'budget_usd')::numeric, budget_usd),
    auto_replenish_enabled = COALESCE((p_updates->>'auto_replenish_enabled')::boolean, auto_replenish_enabled),
    auto_replenish_threshold     = COALESCE((p_updates->>'auto_replenish_threshold')::int, auto_replenish_threshold),
    auto_replenish_amount_usd    = COALESCE((p_updates->>'auto_replenish_amount_usd')::numeric, auto_replenish_amount_usd),
    targeting_rules        = COALESCE(p_updates->'targeting_rules', targeting_rules),
    status                 = COALESCE(p_updates->>'status', status),
    updated_at             = now()
  WHERE id = p_campaign_id;

  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, changes)
  VALUES (v_admin, 'UPDATE_BRAND_CAMPAIGN', 'brand_campaign', p_campaign_id, p_updates);

  RETURN jsonb_build_object('success', true);
END;
$$;

-- Admin RPC: manually grant branded PawBucks to a single user
CREATE OR REPLACE FUNCTION public.admin_grant_branded_pawbucks(
  p_campaign_id uuid,
  p_user_id uuid,
  p_amount integer,
  p_description text DEFAULT 'Admin manual grant'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
  v_campaign record;
  v_remaining integer;
  v_existing_ledger record;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin AND role IN ('admin','superadmin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;

  SELECT * INTO v_campaign FROM public.brand_campaigns WHERE id = p_campaign_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
  END IF;

  v_remaining := v_campaign.pawbucks_pool - v_campaign.total_distributed;
  IF v_remaining < p_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient pool. Remaining: ' || v_remaining);
  END IF;

  -- Activity record
  INSERT INTO public.branded_pawbucks_activity (campaign_id, user_id, type, amount, description)
  VALUES (p_campaign_id, p_user_id, 'earn', p_amount, p_description);

  -- Ledger upsert
  SELECT * INTO v_existing_ledger
  FROM public.branded_pawbucks_ledger
  WHERE campaign_id = p_campaign_id AND user_id = p_user_id;

  IF FOUND THEN
    UPDATE public.branded_pawbucks_ledger
    SET balance = balance + p_amount,
        total_earned = total_earned + p_amount,
        updated_at = now()
    WHERE id = v_existing_ledger.id;
  ELSE
    INSERT INTO public.branded_pawbucks_ledger (campaign_id, user_id, balance, total_earned)
    VALUES (p_campaign_id, p_user_id, p_amount, p_amount);
  END IF;

  -- Update campaign totals
  UPDATE public.brand_campaigns
  SET total_distributed = total_distributed + p_amount,
      updated_at = now()
  WHERE id = p_campaign_id;

  -- Notify recipient
  INSERT INTO public.notifications (user_id, title, message, category)
  VALUES (
    p_user_id,
    '🎁 Branded PawBucks Awarded',
    'You received ' || p_amount || ' branded PawBucks from ' ||
      COALESCE((SELECT brand_name FROM public.brand_accounts WHERE id = v_campaign.brand_id), 'a brand') || '.',
    'promotional'
  );

  -- Audit log
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, changes)
  VALUES (v_admin, 'ADMIN_GRANT_BRANDED_PB', 'brand_campaign', p_campaign_id,
          jsonb_build_object('user_id', p_user_id, 'amount', p_amount, 'description', p_description));

  RETURN jsonb_build_object('success', true, 'amount', p_amount);
END;
$$;