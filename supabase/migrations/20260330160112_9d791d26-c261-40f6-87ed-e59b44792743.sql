
-- Fix Series C: $75k total = $15k upfront + $12k/month × 5 months (6 months total)
CREATE OR REPLACE FUNCTION public.initialize_pet_fund(p_user_id uuid, p_referred_by uuid DEFAULT NULL, p_series_tier text DEFAULT 'series_a', p_cluster_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_ledger_id uuid;
  v_now timestamptz := now();
  v_total integer;
  v_upfront integer;
  v_monthly integer;
  v_months integer;
  v_upfront_min numeric(10,2);
  v_monthly_min numeric(10,2);
BEGIN
  CASE p_series_tier
    WHEN 'series_a' THEN
      v_total := 250000; v_upfront := 20000; v_monthly := 10000; v_months := 23;
      v_upfront_min := 40.00; v_monthly_min := 20.00;
    WHEN 'series_b' THEN
      v_total := 150000; v_upfront := 15000; v_monthly := 15000; v_months := 9;
      v_upfront_min := 30.00; v_monthly_min := 30.00;
    WHEN 'series_c' THEN
      v_total := 75000; v_upfront := 15000; v_monthly := 12000; v_months := 5;
      v_upfront_min := 30.00; v_monthly_min := 20.00;
    WHEN 'standard' THEN
      v_total := 50000; v_upfront := 10000; v_monthly := 10000; v_months := 4;
      v_upfront_min := 20.00; v_monthly_min := 20.00;
    ELSE
      v_total := 50000; v_upfront := 10000; v_monthly := 10000; v_months := 4;
      v_upfront_min := 20.00; v_monthly_min := 20.00;
  END CASE;

  INSERT INTO pet_fund_ledgers (user_id, total_amount, available_balance, escrow_balance, total_released, referred_by, series_tier, cluster_id)
  VALUES (p_user_id, v_total, v_upfront, v_total - v_upfront, v_upfront, p_referred_by, p_series_tier, p_cluster_id)
  ON CONFLICT (user_id) DO NOTHING
  RETURNING id INTO v_ledger_id;

  IF v_ledger_id IS NULL THEN
    SELECT id INTO v_ledger_id FROM pet_fund_ledgers WHERE user_id = p_user_id;
    RETURN v_ledger_id;
  END IF;

  INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, released_at, expires_at)
  VALUES (v_ledger_id, p_user_id, 0, v_upfront, v_upfront_min, 'released', v_now, v_now, v_now + INTERVAL '30 days');

  FOR i IN 1..v_months LOOP
    INSERT INTO pet_fund_releases (ledger_id, user_id, month_number, amount, min_transaction_usd, status, scheduled_at, expires_at)
    VALUES (v_ledger_id, p_user_id, i, v_monthly, v_monthly_min, 'pending', v_now + (i * INTERVAL '30 days'), v_now + ((i + 1) * INTERVAL '30 days'));
  END LOOP;

  IF p_referred_by IS NOT NULL THEN
    INSERT INTO pet_fund_referrer_bonuses (referrer_id, referee_id, amount, status)
    VALUES (p_referred_by, p_user_id, 10000, 'pending')
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN v_ledger_id;
END;
$$;
