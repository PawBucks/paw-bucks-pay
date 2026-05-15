-- 1. Normalize sign on existing redeem rows (must run BEFORE adding the CHECK)
UPDATE public.pawbucks_activity
SET amount = ABS(amount)
WHERE type = 'redeem' AND amount < 0;

-- 2. Add CHECK constraint enforcing the canonical sign rule
ALTER TABLE public.pawbucks_activity
  DROP CONSTRAINT IF EXISTS pawbucks_activity_amount_sign_check;
ALTER TABLE public.pawbucks_activity
  ADD CONSTRAINT pawbucks_activity_amount_sign_check
  CHECK (
    (type = 'earn'   AND amount > 0) OR
    (type = 'redeem' AND amount > 0)
  );

-- 3. Recompute every wallet balance from the ledger as the new source of truth
WITH ledger AS (
  SELECT
    user_id,
    COALESCE(SUM(
      CASE
        WHEN type = 'earn'   THEN amount
        WHEN type = 'redeem' THEN -amount
        ELSE 0
      END
    ), 0)::int AS computed_balance
  FROM public.pawbucks_activity
  GROUP BY user_id
)
UPDATE public.pawbucks_wallet w
SET balance = GREATEST(l.computed_balance, 0),
    last_updated = now()
FROM ledger l
WHERE w.user_id = l.user_id
  AND w.balance <> GREATEST(l.computed_balance, 0);

-- 4. Backfill the 3 historical transactions whose application_fee was stored at 2.5% instead of 3%
UPDATE public.transactions
SET application_fee = ROUND(COALESCE(stripe_amount, 0) * 0.03, 2)
WHERE COALESCE(stripe_amount, 0) > 0
  AND ABS(COALESCE(application_fee, 0) - ROUND(COALESCE(stripe_amount, 0) * 0.03, 2)) > 0.01;

-- 5. Replace get_merchant_analytics so Success Fees come from the actually-stored application_fee
CREATE OR REPLACE FUNCTION public.get_merchant_analytics(p_merchant_id uuid)
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
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
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
  -- Net sales + PawBucks received, accounting for partial refunds
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
      WHEN amount > 0 THEN GREATEST(amount - COALESCE(amount_refunded, 0), 0) / amount
      ELSE 0
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

  -- Refund tracking
  SELECT COUNT(*), COALESCE(SUM(COALESCE(amount_refunded, 0)), 0)
  INTO v_refunded_count, v_refunded_amount
  FROM transactions
  WHERE merchant_id = p_merchant_id
    AND COALESCE(amount_refunded, 0) > 0;

  -- Success Fees: read from the actually-stored application_fee (Stripe source of truth at charge time),
  -- prorated by the non-refunded portion. This avoids charging phantom fees on manual/invoice payments
  -- that never went through Stripe.
  SELECT COALESCE(SUM(
    COALESCE(application_fee, 0) *
    CASE
      WHEN amount > 0 THEN GREATEST(amount - COALESCE(amount_refunded, 0), 0) / amount
      ELSE 0
    END
  ), 0)
  INTO v_fees
  FROM transactions
  WHERE merchant_id = p_merchant_id
    AND status IN ('completed', 'refunded');

  RETURN QUERY SELECT
    ROUND(v_total_sales, 2),
    v_count,
    v_customers,
    ROUND(v_total_sales - v_fees, 2),
    ROUND(v_cashback, 2),
    ROUND(v_pawbucks_received_usd, 2),
    ROUND(v_avg, 2),
    ROUND(v_fees, 2),
    v_refunded_count,
    ROUND(v_refunded_amount, 2);
END;
$function$;