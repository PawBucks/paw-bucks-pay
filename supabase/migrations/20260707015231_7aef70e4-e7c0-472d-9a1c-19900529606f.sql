
-- Remove duplicate PawBucks earn rows created by stripe-webhook payment_intent.succeeded
-- for merchant recurring subscription PaymentIntents that were ALREADY credited by
-- create-merchant-subscription / process-merchant-subscriptions. Roll back the
-- corresponding wallet balance for each affected user.

WITH dups AS (
  SELECT a.id, a.user_id, a.amount
  FROM public.pawbucks_activity a
  WHERE a.type = 'earn'
    AND a.source = 'direct_payment'
    AND EXISTS (
      SELECT 1 FROM public.pawbucks_activity b
      WHERE b.user_id = a.user_id
        AND b.type = 'earn'
        AND b.source IN ('subscription_payment','subscription_renewal')
        AND b.amount = a.amount
        AND abs(extract(epoch FROM (b.created_at - a.created_at))) < 600
    )
),
totals AS (
  SELECT user_id, sum(amount)::bigint AS total FROM dups GROUP BY user_id
),
del AS (
  DELETE FROM public.pawbucks_activity WHERE id IN (SELECT id FROM dups) RETURNING 1
)
UPDATE public.pawbucks_wallet w
SET balance = GREATEST(0, w.balance - t.total)
FROM totals t
WHERE w.user_id = t.user_id;
