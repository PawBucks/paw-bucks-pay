
CREATE OR REPLACE FUNCTION public.get_underwriting_signals(p_merchant_id uuid)
RETURNS TABLE(
  tx_frequency_30d numeric,
  tx_frequency_90d numeric,
  avg_days_between_tx numeric,
  redemption_velocity_avg_hours numeric,
  redemption_rate_pct numeric,
  customer_repeat_rate_pct numeric,
  repeat_customers bigint,
  one_time_customers bigint,
  total_unique_customers bigint,
  avg_review_score numeric,
  review_count bigint,
  five_star_pct numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_tx_30d bigint;
  v_tx_90d bigint;
  v_total_tx bigint;
  v_avg_gap numeric;
  v_redemption_velocity numeric;
  v_redemption_rate numeric;
  v_repeat bigint;
  v_one_time bigint;
  v_total_cust bigint;
  v_repeat_rate numeric;
  v_avg_review numeric;
  v_review_count bigint;
  v_five_star_pct numeric;
BEGIN
  -- Transaction frequency (30d and 90d)
  SELECT COUNT(*) INTO v_tx_30d
  FROM transactions
  WHERE merchant_id = p_merchant_id AND status = 'completed'
    AND created_at >= now() - interval '30 days';

  SELECT COUNT(*) INTO v_tx_90d
  FROM transactions
  WHERE merchant_id = p_merchant_id AND status = 'completed'
    AND created_at >= now() - interval '90 days';

  -- Average days between transactions
  SELECT AVG(gap_days) INTO v_avg_gap
  FROM (
    SELECT EXTRACT(EPOCH FROM (created_at - LAG(created_at) OVER (ORDER BY created_at))) / 86400.0 AS gap_days
    FROM transactions
    WHERE merchant_id = p_merchant_id AND status = 'completed'
  ) gaps
  WHERE gap_days IS NOT NULL;

  -- Redemption velocity: average hours between earning and spending PawBucks for this merchant's customers
  SELECT AVG(EXTRACT(EPOCH FROM (d.created_at - c.created_at)) / 3600.0) INTO v_redemption_velocity
  FROM pawbucks_activity c
  JOIN pawbucks_activity d ON d.user_id = c.user_id AND d.type = 'debit' AND d.created_at > c.created_at
  JOIN transactions t ON t.user_id = c.user_id AND t.merchant_id = p_merchant_id AND t.status = 'completed'
  WHERE c.type = 'credit'
    AND c.source = 'transaction'
  LIMIT 1000;

  -- Redemption rate: % of PawBucks earned from this merchant that have been spent
  WITH merchant_earners AS (
    SELECT DISTINCT user_id FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed' AND user_id IS NOT NULL
  ),
  earned AS (
    SELECT COALESCE(SUM(pa.amount), 0) as total
    FROM pawbucks_activity pa
    JOIN merchant_earners me ON me.user_id = pa.user_id
    WHERE pa.type = 'credit'
  ),
  spent AS (
    SELECT COALESCE(SUM(ABS(pa.amount)), 0) as total
    FROM pawbucks_activity pa
    JOIN merchant_earners me ON me.user_id = pa.user_id
    WHERE pa.type = 'debit'
  )
  SELECT CASE WHEN e.total > 0 THEN ROUND((s.total / e.total) * 100, 1) ELSE 0 END
  INTO v_redemption_rate
  FROM earned e, spent s;

  -- Customer repeat rate
  WITH customer_tx_counts AS (
    SELECT user_id, COUNT(*) as tx_count
    FROM transactions
    WHERE merchant_id = p_merchant_id AND status = 'completed' AND user_id IS NOT NULL
    GROUP BY user_id
  )
  SELECT
    COUNT(*) FILTER (WHERE tx_count > 1),
    COUNT(*) FILTER (WHERE tx_count = 1),
    COUNT(*)
  INTO v_repeat, v_one_time, v_total_cust
  FROM customer_tx_counts;

  v_repeat_rate := CASE WHEN v_total_cust > 0 THEN ROUND((v_repeat::numeric / v_total_cust) * 100, 1) ELSE 0 END;

  -- Review scores
  SELECT
    ROUND(AVG(rating)::numeric, 2),
    COUNT(*),
    CASE WHEN COUNT(*) > 0 THEN ROUND((COUNT(*) FILTER (WHERE rating = 5))::numeric / COUNT(*) * 100, 1) ELSE 0 END
  INTO v_avg_review, v_review_count, v_five_star_pct
  FROM merchant_reviews
  WHERE merchant_id = p_merchant_id;

  RETURN QUERY SELECT
    v_tx_30d::numeric,
    v_tx_90d::numeric,
    COALESCE(v_avg_gap, 0)::numeric,
    COALESCE(v_redemption_velocity, 0)::numeric,
    COALESCE(v_redemption_rate, 0)::numeric,
    v_repeat_rate,
    v_repeat,
    v_one_time,
    v_total_cust,
    COALESCE(v_avg_review, 0)::numeric,
    v_review_count,
    v_five_star_pct;
END;
$$;
