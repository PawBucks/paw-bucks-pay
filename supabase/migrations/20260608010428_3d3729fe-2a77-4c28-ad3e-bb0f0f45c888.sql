
-- ============================================================
-- 1. Brand tagging columns on catalog tables
-- ============================================================
ALTER TABLE public.pet_store_items
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brand_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_pet_store_items_brand_id ON public.pet_store_items(brand_id) WHERE brand_id IS NOT NULL;

ALTER TABLE public.merchant_services
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brand_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_merchant_services_brand_id ON public.merchant_services(brand_id) WHERE brand_id IS NOT NULL;

ALTER TABLE public.invoice_items
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brand_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_items_brand_id ON public.invoice_items(brand_id) WHERE brand_id IS NOT NULL;

ALTER TABLE public.invoice_catalog_items
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brand_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_invoice_catalog_items_brand_id ON public.invoice_catalog_items(brand_id) WHERE brand_id IS NOT NULL;

ALTER TABLE public.partner_offers
  ADD COLUMN IF NOT EXISTS brand_id uuid REFERENCES public.brand_accounts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_partner_offers_brand_id ON public.partner_offers(brand_id) WHERE brand_id IS NOT NULL;

-- ============================================================
-- 2. Activity audit columns + campaign enforcement flag
-- ============================================================
ALTER TABLE public.branded_pawbucks_activity
  ADD COLUMN IF NOT EXISTS source text,
  ADD COLUMN IF NOT EXISTS actor_user_id uuid,
  ADD COLUMN IF NOT EXISTS batch_id uuid;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'branded_pawbucks_activity_source_check'
  ) THEN
    ALTER TABLE public.branded_pawbucks_activity
      ADD CONSTRAINT branded_pawbucks_activity_source_check
      CHECK (source IS NULL OR source = ANY (ARRAY['auto_checkin','manual_grant','bulk_grant','redeem','migration']));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_branded_pawbucks_activity_batch_id
  ON public.branded_pawbucks_activity(batch_id) WHERE batch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_branded_pawbucks_activity_source
  ON public.branded_pawbucks_activity(source) WHERE source IS NOT NULL;

-- Prevent duplicate bulk grants within the same batch
CREATE UNIQUE INDEX IF NOT EXISTS branded_pawbucks_activity_unique_batch_grant
  ON public.branded_pawbucks_activity(campaign_id, user_id, batch_id)
  WHERE batch_id IS NOT NULL AND type = 'earn';

ALTER TABLE public.brand_campaigns
  ADD COLUMN IF NOT EXISTS enforce_product_gate boolean NOT NULL DEFAULT true;

-- ============================================================
-- 3. Helper: compute per-campaign redeemable cents for a cart
-- ============================================================
-- p_line_items: jsonb array of { brand_id (uuid|null), total_cents (int) }
CREATE OR REPLACE FUNCTION public.compute_brand_redeemable_cents(
  p_user_id uuid,
  p_merchant_id uuid,
  p_line_items jsonb
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result jsonb := '[]'::jsonb;
  v_row record;
  v_brand_total_cents bigint;
BEGIN
  IF p_user_id IS NULL OR p_merchant_id IS NULL THEN
    RETURN v_result;
  END IF;

  FOR v_row IN
    SELECT
      l.campaign_id,
      l.balance,
      c.brand_id,
      c.name AS campaign_name,
      c.enforce_product_gate,
      ba.brand_name
    FROM public.branded_pawbucks_ledger l
    JOIN public.brand_campaigns c ON c.id = l.campaign_id
    JOIN public.brand_accounts ba ON ba.id = c.brand_id
    JOIN public.brand_campaign_merchants cm
      ON cm.campaign_id = c.id AND cm.merchant_id = p_merchant_id
    WHERE l.user_id = p_user_id
      AND l.balance > 0
      AND c.status = 'active'
      AND COALESCE(cm.status, 'active') = 'active'
  LOOP
    IF v_row.enforce_product_gate THEN
      SELECT COALESCE(SUM((item->>'total_cents')::bigint), 0)
        INTO v_brand_total_cents
      FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item
      WHERE (item->>'brand_id')::uuid = v_row.brand_id;
    ELSE
      -- Gate disabled: full cart counts as eligible
      SELECT COALESCE(SUM((item->>'total_cents')::bigint), 0)
        INTO v_brand_total_cents
      FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item;
    END IF;

    v_result := v_result || jsonb_build_object(
      'campaign_id', v_row.campaign_id,
      'campaign_name', v_row.campaign_name,
      'brand_id', v_row.brand_id,
      'brand_name', v_row.brand_name,
      'user_balance_pb', v_row.balance,
      -- 1 PB = $0.001 = 0.1 cents → cap_pb = brand_cents * 10
      'eligible_cap_pb', LEAST(v_row.balance, GREATEST(v_brand_total_cents * 10, 0))::int,
      'eligible_brand_cents', v_brand_total_cents,
      'enforce_product_gate', v_row.enforce_product_gate
    );
  END LOOP;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.compute_brand_redeemable_cents(uuid, uuid, jsonb) TO authenticated, service_role;

-- ============================================================
-- 4. Strict redemption: redeem_branded_pawbucks_v2 (product+merchant gate)
-- ============================================================
CREATE OR REPLACE FUNCTION public.redeem_branded_pawbucks_v2(
  p_user_id uuid,
  p_merchant_id uuid,
  p_amount integer,
  p_line_items jsonb,
  p_transaction_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_remaining integer := GREATEST(COALESCE(p_amount, 0), 0);
  v_total_redeemed integer := 0;
  v_breakdown jsonb := '[]'::jsonb;
  v_row record;
  v_take integer;
  v_eligibility jsonb;
  v_campaign_cap integer;
  v_desc text;
BEGIN
  IF v_remaining = 0 OR p_user_id IS NULL OR p_merchant_id IS NULL THEN
    RETURN jsonb_build_object('success', true, 'redeemed', 0, 'breakdown', v_breakdown);
  END IF;

  -- Idempotency on transaction_id
  IF p_transaction_id IS NOT NULL THEN
    SELECT COALESCE(SUM(ABS(a.amount)), 0)::int,
           COALESCE(jsonb_agg(jsonb_build_object('campaign_id', a.campaign_id, 'amount', ABS(a.amount))), '[]'::jsonb)
      INTO v_total_redeemed, v_breakdown
      FROM public.branded_pawbucks_activity a
     WHERE a.user_id = p_user_id
       AND a.transaction_id = p_transaction_id
       AND a.type = 'redeem';
    IF v_total_redeemed > 0 THEN
      RETURN jsonb_build_object('success', true, 'redeemed', v_total_redeemed, 'breakdown', v_breakdown, 'idempotent', true);
    END IF;
  END IF;

  v_eligibility := public.compute_brand_redeemable_cents(p_user_id, p_merchant_id, p_line_items);

  FOR v_row IN
    SELECT
      l.id AS ledger_id,
      l.campaign_id,
      l.balance,
      c.name AS campaign_name,
      ba.brand_name,
      ba.id AS brand_id
    FROM public.branded_pawbucks_ledger l
    JOIN public.brand_campaigns c ON c.id = l.campaign_id
    JOIN public.brand_accounts ba ON ba.id = c.brand_id
    JOIN public.brand_campaign_merchants cm
      ON cm.campaign_id = c.id AND cm.merchant_id = p_merchant_id
    WHERE l.user_id = p_user_id
      AND l.balance > 0
      AND c.status = 'active'
      AND COALESCE(cm.status, 'active') = 'active'
    ORDER BY l.created_at ASC
    FOR UPDATE OF l
  LOOP
    EXIT WHEN v_remaining <= 0;

    SELECT COALESCE((elem->>'eligible_cap_pb')::int, 0)
      INTO v_campaign_cap
    FROM jsonb_array_elements(v_eligibility) AS elem
    WHERE (elem->>'campaign_id')::uuid = v_row.campaign_id;

    v_campaign_cap := COALESCE(v_campaign_cap, 0);
    IF v_campaign_cap <= 0 THEN CONTINUE; END IF;

    v_take := LEAST(v_row.balance, v_remaining, v_campaign_cap);
    IF v_take <= 0 THEN CONTINUE; END IF;

    v_desc := COALESCE(p_description, COALESCE(v_row.brand_name, 'Brand') || ' branded PawBucks redeemed');

    UPDATE public.branded_pawbucks_ledger
       SET balance = balance - v_take, total_spent = total_spent + v_take, updated_at = now()
     WHERE id = v_row.ledger_id;

    INSERT INTO public.branded_pawbucks_activity
      (campaign_id, user_id, merchant_id, type, amount, description, transaction_id, source)
    VALUES
      (v_row.campaign_id, p_user_id, p_merchant_id, 'redeem', -v_take, v_desc, p_transaction_id, 'redeem');

    UPDATE public.brand_campaigns
       SET total_redeemed = COALESCE(total_redeemed, 0) + v_take, updated_at = now()
     WHERE id = v_row.campaign_id;

    v_breakdown := v_breakdown || jsonb_build_object(
      'campaign_id', v_row.campaign_id,
      'campaign_name', v_row.campaign_name,
      'brand_name', v_row.brand_name,
      'amount', v_take
    );
    v_total_redeemed := v_total_redeemed + v_take;
    v_remaining := v_remaining - v_take;
  END LOOP;

  RETURN jsonb_build_object(
    'success', true,
    'redeemed', v_total_redeemed,
    'unallocated', v_remaining,
    'breakdown', v_breakdown
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.redeem_branded_pawbucks_v2(uuid, uuid, integer, jsonb, uuid, text) TO service_role;

-- ============================================================
-- 5. Bulk grant RPC (superadmin-only, idempotent per batch)
-- ============================================================
CREATE OR REPLACE FUNCTION public.admin_bulk_grant_branded_pawbucks(
  p_campaign_id uuid,
  p_user_ids uuid[],
  p_amount integer,
  p_batch_id uuid,
  p_actor_user_id uuid,
  p_description text DEFAULT 'Admin bulk grant'
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_campaign record;
  v_pool_remaining integer;
  v_total_needed bigint;
  v_user_id uuid;
  v_granted integer := 0;
  v_skipped integer := 0;
  v_brand_name text;
BEGIN
  IF NOT (public.is_superadmin(p_actor_user_id) OR public.has_role(p_actor_user_id, 'superadmin'::app_role)) THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authorized');
  END IF;
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount must be positive');
  END IF;
  IF p_user_ids IS NULL OR array_length(p_user_ids, 1) IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'No recipients');
  END IF;

  SELECT c.*, ba.brand_name INTO v_campaign
  FROM public.brand_campaigns c
  JOIN public.brand_accounts ba ON ba.id = c.brand_id
  WHERE c.id = p_campaign_id;
  IF v_campaign IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Campaign not found');
  END IF;

  v_pool_remaining := v_campaign.pawbucks_pool - v_campaign.total_distributed;
  v_total_needed := (p_amount::bigint) * array_length(p_user_ids, 1);
  IF v_total_needed > v_pool_remaining THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient pool', 'needed', v_total_needed, 'remaining', v_pool_remaining);
  END IF;

  v_brand_name := COALESCE(v_campaign.brand_name, 'Brand');

  FOREACH v_user_id IN ARRAY p_user_ids LOOP
    BEGIN
      INSERT INTO public.branded_pawbucks_activity
        (campaign_id, user_id, type, amount, description, source, actor_user_id, batch_id)
      VALUES
        (p_campaign_id, v_user_id, 'earn', p_amount, p_description, 'bulk_grant', p_actor_user_id, p_batch_id);

      INSERT INTO public.branded_pawbucks_ledger (campaign_id, user_id, balance, total_earned)
      VALUES (p_campaign_id, v_user_id, p_amount, p_amount)
      ON CONFLICT (campaign_id, user_id) DO UPDATE
        SET balance = public.branded_pawbucks_ledger.balance + EXCLUDED.balance,
            total_earned = public.branded_pawbucks_ledger.total_earned + EXCLUDED.total_earned,
            updated_at = now();

      -- Also credit user's regular wallet so they can see/use it
      INSERT INTO public.pawbucks_wallet (user_id, balance)
      VALUES (v_user_id, p_amount)
      ON CONFLICT (user_id) DO UPDATE SET balance = public.pawbucks_wallet.balance + EXCLUDED.balance;

      INSERT INTO public.pawbucks_activity (user_id, type, amount, source, description)
      VALUES (v_user_id, 'earn', p_amount, 'branded', v_brand_name || ' campaign bonus');

      v_granted := v_granted + 1;
    EXCEPTION WHEN unique_violation THEN
      v_skipped := v_skipped + 1;
    END;
  END LOOP;

  UPDATE public.brand_campaigns
     SET total_distributed = total_distributed + (v_granted * p_amount),
         updated_at = now()
   WHERE id = p_campaign_id;

  RETURN jsonb_build_object(
    'success', true,
    'granted_users', v_granted,
    'skipped_users', v_skipped,
    'total_pb', v_granted * p_amount,
    'batch_id', p_batch_id
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_bulk_grant_branded_pawbucks(uuid, uuid[], integer, uuid, uuid, text) TO authenticated, service_role;
