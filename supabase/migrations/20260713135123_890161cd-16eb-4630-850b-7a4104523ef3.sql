-- Normalize transaction-linked PawBucks evidence after historical tier/rounding drift.

-- 1) Link remaining nearby transaction ledger rows, including older source labels.
WITH candidate_links AS (
  SELECT
    pa.id AS activity_id,
    t.id AS transaction_id,
    row_number() OVER (
      PARTITION BY pa.id
      ORDER BY abs(extract(epoch FROM (pa.created_at - t.created_at))) ASC, t.created_at DESC
    ) AS rn
  FROM public.pawbucks_activity pa
  JOIN public.transactions t
    ON t.user_id = pa.user_id
   AND t.merchant_id = pa.partner_id
   AND t.status IN ('completed', 'refunded')
   AND pa.created_at BETWEEN t.created_at - interval '3 minutes'
                         AND t.created_at + interval '3 minutes'
  WHERE pa.transaction_id IS NULL
    AND pa.type IN ('earn', 'redeem')
    AND pa.source <> 'expiration'
)
UPDATE public.pawbucks_activity pa
SET transaction_id = cl.transaction_id
FROM candidate_links cl
WHERE cl.rn = 1
  AND pa.id = cl.activity_id;

-- 2) If exactly one earn ledger row exists for a completed transaction and it
-- is materially larger than transactions.rewards_earned, restore the
-- transaction field from the ledger. These are historical tier-resolution
-- cases (for example PawPass/PawPass+ earn rows that a prior Free-tier
-- recompute overwrote in transactions).
WITH linked AS (
  SELECT
    t.id,
    t.rewards_earned,
    COUNT(pa.id) FILTER (WHERE pa.type = 'earn') AS earn_rows,
    COALESCE(SUM(pa.amount) FILTER (WHERE pa.type = 'earn'), 0)::integer AS ledger_earned
  FROM public.transactions t
  LEFT JOIN public.pawbucks_activity pa ON pa.transaction_id = t.id
  WHERE t.status = 'completed'
  GROUP BY t.id, t.rewards_earned
)
UPDATE public.transactions t
SET rewards_earned = linked.ledger_earned,
    cashback_earned = linked.ledger_earned,
    updated_at = now()
FROM linked
WHERE linked.id = t.id
  AND linked.earn_rows = 1
  AND linked.ledger_earned > COALESCE(t.rewards_earned, 0)
  AND linked.ledger_earned - COALESCE(t.rewards_earned, 0) > 1;

-- 3) For exactly-one-earn rows with only a 1 PB rounding delta, sync the
-- ledger to the canonical transaction reward amount.
UPDATE public.pawbucks_activity pa
SET amount = t.rewards_earned,
    description = CASE
      WHEN pa.description IS NULL THEN pa.description
      ELSE regexp_replace(pa.description, 'Earned [0-9,]+ PawBucks', 'Earned ' || to_char(t.rewards_earned, 'FM999G999G999G990') || ' PawBucks')
    END
FROM public.transactions t
WHERE pa.transaction_id = t.id
  AND t.status = 'completed'
  AND pa.type = 'earn'
  AND abs(pa.amount - COALESCE(t.rewards_earned, 0)) = 1;

-- 4) Insert missing redemption rows for completed transactions whose
-- pawbucks_used amount has no matching non-expiration redemption row.
WITH per_tx AS (
  SELECT
    t.id,
    t.user_id,
    t.merchant_id,
    t.created_at,
    COALESCE(t.pawbucks_used, 0)::integer AS pawbucks_used,
    COALESCE(SUM(pa.amount) FILTER (WHERE pa.type = 'redeem' AND pa.source <> 'expiration'), 0)::integer AS ledger_redeemed
  FROM public.transactions t
  LEFT JOIN public.pawbucks_activity pa ON pa.transaction_id = t.id
  WHERE t.status = 'completed'
  GROUP BY t.id, t.user_id, t.merchant_id, t.created_at, t.pawbucks_used
), missing AS (
  SELECT *, pawbucks_used - ledger_redeemed AS missing_redeem
  FROM per_tx
  WHERE pawbucks_used > ledger_redeemed
)
INSERT INTO public.pawbucks_activity (
  user_id,
  amount,
  type,
  source,
  partner_id,
  transaction_id,
  description,
  pawbucks_status,
  created_at
)
SELECT
  user_id,
  missing_redeem,
  'redeem',
  'transaction_payment',
  merchant_id,
  id,
  'Backfill: PawBucks applied to completed transaction but missing from ledger',
  'available',
  created_at - interval '1 millisecond'
FROM missing
WHERE missing_redeem > 0;

-- 5) Recompute all pet-owner wallets from the corrected transaction-aware ledger.
DO $$
DECLARE
  u uuid;
BEGIN
  FOR u IN
    SELECT DISTINCT p.id
    FROM public.profiles p
    WHERE p.user_type = 'pet_owner'
      AND (
        EXISTS (SELECT 1 FROM public.pawbucks_activity pa WHERE pa.user_id = p.id)
        OR EXISTS (SELECT 1 FROM public.pawbucks_wallet pw WHERE pw.user_id = p.id)
      )
  LOOP
    PERFORM public.recompute_pawbucks_wallet(u);
  END LOOP;
END $$;