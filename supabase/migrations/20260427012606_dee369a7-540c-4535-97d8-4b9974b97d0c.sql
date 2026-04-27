
-- 1. Idempotency guard at the database layer (handles retries/reloads/race conditions)
CREATE UNIQUE INDEX IF NOT EXISTS branded_pawbucks_activity_unique_checkin_earn
  ON public.branded_pawbucks_activity (campaign_id, user_id, checkin_id)
  WHERE type = 'earn' AND checkin_id IS NOT NULL;

-- 2. Atomic credit function: writes branded activity + branded ledger + main wallet + main activity in one transaction.
CREATE OR REPLACE FUNCTION public.credit_branded_pawbucks(
  p_campaign_id uuid,
  p_user_id uuid,
  p_merchant_id uuid,
  p_checkin_id uuid,
  p_amount integer,
  p_description text,
  p_brand_name text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_activity_id uuid;
  v_already boolean := false;
BEGIN
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'invalid_amount');
  END IF;

  -- Insert branded activity. If a duplicate (same campaign/user/checkin), we treat as already credited.
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

  -- Update branded per-campaign ledger
  INSERT INTO public.branded_pawbucks_ledger (campaign_id, user_id, balance, total_earned)
  VALUES (p_campaign_id, p_user_id, p_amount, p_amount)
  ON CONFLICT (campaign_id, user_id) DO UPDATE
    SET balance = public.branded_pawbucks_ledger.balance + EXCLUDED.balance,
        total_earned = public.branded_pawbucks_ledger.total_earned + EXCLUDED.total_earned;

  -- CRITICAL: Mirror into main spendable wallet so the user actually sees/spends the credit.
  INSERT INTO public.pawbucks_wallet (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id) DO UPDATE
    SET balance = public.pawbucks_wallet.balance + EXCLUDED.balance,
        last_updated = now();

  -- Mirror into pawbucks_activity (source='branded' is excluded from 60-day expiry per set_pawbucks_expiration trigger).
  INSERT INTO public.pawbucks_activity
    (user_id, type, amount, source, partner_id, description, pawbucks_status)
  VALUES
    (p_user_id, 'earn', p_amount, 'branded', p_merchant_id,
     COALESCE(p_description, p_brand_name || ' branded campaign reward'), 'available');

  -- Bump campaign totals
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
$$;

-- Ensure ledger has the unique constraint we rely on for ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.branded_pawbucks_ledger'::regclass
      AND contype = 'u'
      AND conname = 'branded_pawbucks_ledger_campaign_user_unique'
  ) THEN
    -- Add it only if no conflicting constraint already covers it
    IF NOT EXISTS (
      SELECT 1
      FROM pg_indexes
      WHERE schemaname='public' AND tablename='branded_pawbucks_ledger'
        AND indexdef ILIKE '%UNIQUE%(campaign_id, user_id)%'
    ) THEN
      ALTER TABLE public.branded_pawbucks_ledger
        ADD CONSTRAINT branded_pawbucks_ledger_campaign_user_unique
        UNIQUE (campaign_id, user_id);
    END IF;
  END IF;
END $$;

-- 3. Backfill: any branded earn that never landed in the user's main wallet/activity gets repaired.
DO $$
DECLARE
  r RECORD;
  v_brand_name text;
BEGIN
  FOR r IN
    SELECT bpa.id, bpa.user_id, bpa.amount, bpa.merchant_id, bpa.campaign_id, bpa.description, bpa.created_at
    FROM public.branded_pawbucks_activity bpa
    WHERE bpa.type = 'earn'
      AND NOT EXISTS (
        -- No matching mirrored entry in main activity for this user/amount/source within 1 minute
        SELECT 1 FROM public.pawbucks_activity pa
        WHERE pa.user_id = bpa.user_id
          AND pa.source = 'branded'
          AND pa.amount = bpa.amount
          AND pa.partner_id IS NOT DISTINCT FROM bpa.merchant_id
          AND pa.created_at BETWEEN bpa.created_at - interval '5 minutes' AND bpa.created_at + interval '5 minutes'
      )
  LOOP
    SELECT ba.brand_name INTO v_brand_name
    FROM public.brand_campaigns bc
    JOIN public.brand_accounts ba ON ba.id = bc.brand_id
    WHERE bc.id = r.campaign_id;

    INSERT INTO public.pawbucks_wallet (user_id, balance)
    VALUES (r.user_id, r.amount)
    ON CONFLICT (user_id) DO UPDATE
      SET balance = public.pawbucks_wallet.balance + EXCLUDED.balance,
          last_updated = now();

    INSERT INTO public.pawbucks_activity
      (user_id, type, amount, source, partner_id, description, pawbucks_status, created_at)
    VALUES
      (r.user_id, 'earn', r.amount, 'branded', r.merchant_id,
       COALESCE(r.description, COALESCE(v_brand_name,'Brand') || ' branded campaign reward (backfilled)'),
       'available', r.created_at);
  END LOOP;
END $$;
