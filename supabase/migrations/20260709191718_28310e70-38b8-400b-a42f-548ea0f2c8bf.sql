
-- Remove duplicate direct_payment earn row for Frisco's 7/9 subscription payment
DELETE FROM public.pawbucks_activity
WHERE id = 'e6e81046-dff7-47f8-adac-1d173c70c06b'
  AND source = 'direct_payment'
  AND transaction_id = '4c0768e7-83a1-433f-a255-4b834ca4cbd5';

-- Correct Frisco's wallet balance (remove the extra 3,490 PB)
UPDATE public.pawbucks_wallet
SET balance = balance - 3490
WHERE user_id = '77864992-1349-441a-8a8d-28cf23ef2ece'
  AND balance >= 3490;

-- Attach the correct earn row to the transaction for audit trail
UPDATE public.pawbucks_activity
SET transaction_id = '4c0768e7-83a1-433f-a255-4b834ca4cbd5',
    stripe_payment_intent_id = 'pi_3TrMARH2J0mduO8S1U1IldgD'
WHERE id = '91bb1f54-8150-49fe-9537-53416f806bb9';
