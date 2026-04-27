-- 1. Tie branded activity rows to a transaction for redemption auditability
ALTER TABLE public.branded_pawbucks_activity
  ADD COLUMN IF NOT EXISTS transaction_id uuid;

CREATE INDEX IF NOT EXISTS idx_branded_pawbucks_activity_transaction_id
  ON public.branded_pawbucks_activity(transaction_id)
  WHERE transaction_id IS NOT NULL;

-- 2. Idempotency: never credit/debit the same campaign twice for the same transaction
CREATE UNIQUE INDEX IF NOT EXISTS branded_pawbucks_activity_unique_tx_redeem
  ON public.branded_pawbucks_activity(campaign_id, user_id, transaction_id, type)
  WHERE transaction_id IS NOT NULL;

-- 3. Atomic redemption RPC
CREATE OR REPLACE FUNCTION public.redeem_branded_pawbucks(
  p_user_id uuid,
  p_merchant_id uuid,
  p_amount integer,
  p_transaction_id uuid DEFAULT NULL,
  p_description text DEFAULT NULL
)
RETURNS jsonb
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
  v_brand_name text;
  v_desc text;
BEGIN
  IF v_remaining = 0 OR p_user_id IS NULL OR p_merchant_id IS NULL THEN
    RETURN jsonb_build_object(
      'success', true,
      'redeemed', 0,
      'breakdown', v_breakdown
    );
  END IF;

  -- Idempotency: if we've already redeemed for this transaction, return prior breakdown.
  IF p_transaction_id IS NOT NULL THEN
    SELECT
      COALESCE(SUM(ABS(a.amount)), 0)::int,
      COALESCE(jsonb_agg(jsonb_build_object(
        'campaign_id', a.campaign_id,
        'amount', ABS(a.amount)
      )), '[]'::jsonb)
    INTO v_total_redeemed, v_breakdown
    FROM public.branded_pawbucks_activity a
    WHERE a.user_id = p_user_id
      AND a.transaction_id = p_transaction_id
      AND a.type = 'redeem';

    IF v_total_redeemed > 0 THEN
      RETURN jsonb_build_object(
        'success', true,
        'redeemed', v_total_redeemed,
        'breakdown', v_breakdown,
        'idempotent', true
      );
    END IF;
  END IF;

  -- FIFO allocation across user's branded balances at active campaigns running at this merchant.
  FOR v_row IN
    SELECT l.id AS ledger_id, l.campaign_id, l.balance, c.name AS campaign_name,
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
    ORDER BY l.created_at ASC
    FOR UPDATE OF l
  LOOP
    EXIT WHEN v_remaining <= 0;

    v_take := LEAST(v_row.balance, v_remaining);
    v_brand_name := COALESCE(v_row.brand_name, 'Brand');
    v_desc := COALESCE(
      p_description,
      v_brand_name || ' branded PawBucks redeemed'
    );

    -- Decrement per-campaign user ledger
    UPDATE public.branded_pawbucks_ledger
       SET balance = balance - v_take,
           total_spent = total_spent + v_take,
           updated_at = now()
     WHERE id = v_row.ledger_id;

    -- Record the redemption activity (negative amount is the convention used elsewhere)
    INSERT INTO public.branded_pawbucks_activity (
      campaign_id, user_id, merchant_id, type, amount,
      description, transaction_id
    ) VALUES (
      v_row.campaign_id, p_user_id, p_merchant_id, 'redeem', -v_take,
      v_desc, p_transaction_id
    );

    -- Bump campaign-level total_redeemed counter
    UPDATE public.brand_campaigns
       SET total_redeemed = COALESCE(total_redeemed, 0) + v_take,
           updated_at = now()
     WHERE id = v_row.campaign_id;

    v_breakdown := v_breakdown || jsonb_build_object(
      'campaign_id', v_row.campaign_id,
      'campaign_name', v_row.campaign_name,
      'brand_name', v_brand_name,
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

GRANT EXECUTE ON FUNCTION public.redeem_branded_pawbucks(uuid, uuid, integer, uuid, text) TO authenticated, service_role;