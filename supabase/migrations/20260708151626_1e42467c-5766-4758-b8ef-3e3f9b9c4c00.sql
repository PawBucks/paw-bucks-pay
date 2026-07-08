
UPDATE public.pawbucks_wallet pw
SET balance = COALESCE((
  SELECT SUM(CASE WHEN type = 'earn' THEN amount
                  WHEN type = 'redeem' THEN -amount
                  ELSE 0 END)
  FROM public.pawbucks_activity pa
  WHERE pa.user_id = pw.user_id
), 0),
last_updated = now();

UPDATE public.pawbucks_wallet SET balance = 0 WHERE balance < 0;
