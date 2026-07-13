
-- Option B: Recompute transactions.rewards_earned strictly by formula
-- (stripe_amount * tier_multiplier at time of transaction), sync the
-- linked earn ledger rows, then recompute all wallets from the ledger.

-- Helper: resolve tier multiplier at a given timestamp for a given user
CREATE OR REPLACE FUNCTION public._tier_multiplier_at(p_user_id uuid, p_at timestamptz)
RETURNS integer
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT CASE
      WHEN lower(s.subscription_tier) IN ('pawpass_plus','plus') THEN 30
      WHEN lower(s.subscription_tier) IN ('pawpass','basic')      THEN 20
      ELSE 10
    END
    FROM public.subscriptions s
    WHERE s.user_id = p_user_id
      AND s.start_date <= p_at
      AND (s.expires_at IS NULL OR s.expires_at > p_at)
      AND (s.status IN ('active','trialing') OR s.is_manual_upgrade = true)
    ORDER BY s.start_date DESC
    LIMIT 1
  ), 10);
$$;

-- 1) Recompute rewards_earned strictly by formula
WITH recomputed AS (
  SELECT
    t.id,
    GREATEST(0, ROUND(COALESCE(t.stripe_amount, 0) * public._tier_multiplier_at(t.user_id, t.created_at)))::integer AS new_rewards
  FROM public.transactions t
  WHERE t.user_id IS NOT NULL
)
UPDATE public.transactions t
SET rewards_earned = r.new_rewards,
    updated_at = now()
FROM recomputed r
WHERE r.id = t.id
  AND t.rewards_earned IS DISTINCT FROM r.new_rewards;

-- 2) Sync linked earn ledger rows to match the corrected rewards_earned.
--    Only touches earn rows that reference a transaction directly. Non-transaction
--    earn sources (admin_credit, subscription_payment, receipt_submission, etc.)
--    are intentionally left alone here.
UPDATE public.pawbucks_activity pa
SET amount = t.rewards_earned
FROM public.transactions t
WHERE pa.transaction_id = t.id
  AND pa.type = 'earn'
  AND pa.amount IS DISTINCT FROM t.rewards_earned
  AND t.rewards_earned > 0;

-- 2b) Delete zero-amount earn rows tied to transactions whose corrected reward is 0
--     (fully-PB payments should not create an earn entry).
DELETE FROM public.pawbucks_activity pa
USING public.transactions t
WHERE pa.transaction_id = t.id
  AND pa.type = 'earn'
  AND t.rewards_earned = 0;

-- 3) Global wallet recompute from the (now-corrected) ledger.
DO $$
DECLARE
  u uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT user_id FROM public.pawbucks_wallet
    UNION
    SELECT DISTINCT user_id FROM public.pawbucks_activity WHERE user_id IS NOT NULL
  LOOP
    PERFORM public.recompute_pawbucks_wallet(u);
  END LOOP;
END $$;

DROP FUNCTION public._tier_multiplier_at(uuid, timestamptz);
