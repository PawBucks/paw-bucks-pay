DELETE FROM public.wallet_activity WHERE type = 'cashback';

UPDATE public.wallets w
SET balance = COALESCE(sub.net, 0),
    last_updated = now()
FROM (
  SELECT user_id,
         SUM(CASE
           WHEN type IN ('credit','deposit','refund','topup','payout') THEN amount
           WHEN type IN ('debit','purchase','withdrawal','fee') THEN -amount
           ELSE 0 END) AS net
  FROM public.wallet_activity GROUP BY user_id
) sub
WHERE w.user_id = sub.user_id;

UPDATE public.wallets
SET balance = 0, last_updated = now()
WHERE balance < 0
   OR user_id NOT IN (SELECT DISTINCT user_id FROM public.wallet_activity);

UPDATE public.pawbucks_wallet pw
SET balance = GREATEST(0, COALESCE(sub.net, 0)),
    last_updated = now()
FROM (
  SELECT user_id,
         SUM(CASE WHEN type='earn' THEN amount
                  WHEN type='redeem' THEN -amount ELSE 0 END) AS net
  FROM public.pawbucks_activity GROUP BY user_id
) sub
WHERE pw.user_id = sub.user_id;

UPDATE public.wallets w
SET total_spent = COALESCE(sub.spent, 0),
    last_updated = now()
FROM (
  SELECT user_id,
         SUM(CASE WHEN type IN ('debit','purchase') THEN amount ELSE 0 END) AS spent
  FROM public.wallet_activity GROUP BY user_id
) sub
WHERE w.user_id = sub.user_id;
