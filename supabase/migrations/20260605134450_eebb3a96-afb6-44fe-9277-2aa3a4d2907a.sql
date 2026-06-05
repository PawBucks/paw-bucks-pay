
-- Backfill missing PawBucks rewards for Gina Marinelli's $140 invoice payment
-- (txn 0ad43f3f, pi_3TdRCgH2J0mduO8S1lexh8us). The original webhook recorded
-- rewards_earned=1400 PB on the transaction but never credited her wallet
-- because the payer was unauthenticated and reward logic gated on metadata.user_id.
UPDATE public.pawbucks_wallet
SET balance = balance + 1400,
    last_updated = now()
WHERE user_id = 'b7f3e7c4-f1ef-4276-947c-04d32a2d8f0f';

INSERT INTO public.pawbucks_activity (user_id, type, amount, source, partner_id, description)
VALUES (
  'b7f3e7c4-f1ef-4276-947c-04d32a2d8f0f',
  'earn',
  1400,
  'Invoice Payment',
  '4d7a445c-5b3f-4090-876e-eb482ab10243',
  'Earned 1400 PawBucks (Free 10x) from $140.00 invoice payment (backfilled — Invoice #IHD1103)'
);
