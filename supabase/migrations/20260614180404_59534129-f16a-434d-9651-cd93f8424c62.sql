
-- Strict guardrails for Branded PawBucks redemption.
-- 1. Always enforce product gate (ignore per-campaign toggle) — Branded PB can
--    only redeem against line items tagged with the funding brand.
-- 2. Backfill any campaigns that had the gate disabled and lock the default.
-- (Idempotency / no double-redeem is already enforced by the existing unique
--  index branded_pawbucks_activity_unique_tx_redeem on
--  (campaign_id, user_id, transaction_id, type) WHERE transaction_id IS NOT NULL.)

UPDATE public.brand_campaigns
   SET enforce_product_gate = true
 WHERE enforce_product_gate IS DISTINCT FROM true;

ALTER TABLE public.brand_campaigns
  ALTER COLUMN enforce_product_gate SET DEFAULT true;

CREATE OR REPLACE FUNCTION public.compute_brand_redeemable_cents(
  p_user_id uuid,
  p_merchant_id uuid,
  p_line_items jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
    -- STRICT: only line items tagged with the funding brand are eligible.
    -- Campaign-level toggle is intentionally ignored to prevent misuse.
    SELECT COALESCE(SUM((item->>'total_cents')::bigint), 0)
      INTO v_brand_total_cents
    FROM jsonb_array_elements(COALESCE(p_line_items, '[]'::jsonb)) AS item
    WHERE NULLIF(item->>'brand_id','')::uuid = v_row.brand_id;

    v_result := v_result || jsonb_build_object(
      'campaign_id', v_row.campaign_id,
      'campaign_name', v_row.campaign_name,
      'brand_id', v_row.brand_id,
      'brand_name', v_row.brand_name,
      'user_balance_pb', v_row.balance,
      -- 1 PB = $0.001 = 0.1 cents → cap_pb = brand_cents * 10
      'eligible_cap_pb', LEAST(v_row.balance, GREATEST(v_brand_total_cents * 10, 0))::int,
      'eligible_brand_cents', v_brand_total_cents,
      'enforce_product_gate', true
    );
  END LOOP;

  RETURN v_result;
END;
$function$;
