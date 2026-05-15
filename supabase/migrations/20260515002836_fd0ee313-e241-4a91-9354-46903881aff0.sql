-- Fix merchant analytics to authoritatively derive Success Fees from formula
-- (net_sales - pawbucks_received_usd) * 3%, and accurately net out refunds
-- (including partial refunds) for sales, fees, and rewards given.

DROP FUNCTION IF EXISTS public.get_merchant_analytics(UUID);

CREATE OR REPLACE FUNCTION public.get_merchant_analytics(p_merchant_id UUID)
RETURNS TABLE(
  total_sales numeric,
  transaction_count bigint,
  total_customers bigint,
  total_earnings numeric,
  total_cashback numeric,
  total_pawbucks_received numeric,
  avg_transaction_amount numeric,
  total_fees numeric,
  refunded_transactions bigint,
  refunded_amount numeric
) AS $$
DECLARE
  v_total_sales numeric := 0;
  v_pawbucks_received_usd numeric := 0;
  v_pawbucks_received_pb numeric := 0;
  v_cashback numeric := 0;
  v_count bigint := 0;
  v_customers bigint := 0;
  v_avg numeric := 0;
  v_fees numeric := 0;
  v_refunded_count bigint := 0;
  v_refunded_amount numeric := 0;
BEGIN
  -- Net sales across completed AND refunded statuses (handles partial refunds)
  SELECT
    COALESCE(SUM(GREATEST(amount - COALESCE(amount_refunded, 0), 0)), 0),
    COALESCE(SUM(
      GREATEST(COALESCE(pawbucks_used, 0) - COALESCE(pawbucks_refunded, 0), 0)
    ), 0)
  INTO v_total_sales, v_pawbucks_received_pb
  FROM transactions
  WHERE merchant_id = p_merchant_id
    AND status IN ('completed', 'refunded');

  v_pawbucks_received_usd := v_pawbucks_received_pb / 1000.0;

  -- Cashback given to customers, prorated by non-refunded portion
  SELECT COALESCE(SUM(
    COALESCE(cashback_earned, 0) *
    CASE
      WHEN amount IS NULL OR amount = 0 THEN 1
      ELSE GREATEST(amount - COALESCE(amount_refunded, 0), 0) / amount
    END
  ), 0)
  INTO v_cashback
  FROM transactions
  WHERE merchant_id = p_merchant_id
    AND status IN ('completed', 'refunded');

  -- Counts: only fully-completed transactions
  SELECT COUNT(*), COUNT(DISTINCT user_id), COALESCE(AVG(amount), 0)
  INTO v_count, v_customers, v_avg
  FROM transactions
  WHERE merchant_id = p_merchant_id AND status = 'completed';

  -- Refund tracking: any transaction with partial or full refund
  SELECT COUNT(*), COALESCE(SUM(COALESCE(amount_refunded, 0)), 0)
  INTO v_refunded_count, v_refunded_amount
  FROM transactions
  WHERE merchant_id = p_merchant_id
    AND COALESCE(amount_refunded, 0) > 0;

  -- Success Fees = 3% of the Stripe-funded portion only (never on PawBucks)
  v_fees := ROUND(GREATEST(v_total_sales - v_pawbucks_received_usd, 0) * 0.03, 2);

  RETURN QUERY SELECT
    ROUND(v_total_sales, 2),
    v_count,
    v_customers,
    ROUND(v_total_sales - v_fees, 2),
    ROUND(v_cashback, 2),
    ROUND(v_pawbucks_received_usd, 2),
    ROUND(v_avg, 2),
    v_fees,
    v_refunded_count,
    ROUND(v_refunded_amount, 2);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION public.get_merchant_analytics(uuid) IS
'Authoritative merchant analytics. Success Fees derived as (net_sales - pawbucks_received_usd) * 3%. Nets partial refunds from sales, pawbucks received, and rewards given.';