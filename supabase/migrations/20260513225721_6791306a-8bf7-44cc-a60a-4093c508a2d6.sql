UPDATE public.transactions
SET amount_refunded = 10.00,
    updated_at = now()
WHERE id = 'f6164c89-b9f9-4cdf-a823-5d65fd865d89'
  AND status = 'refunded'
  AND amount_refunded = 0;

INSERT INTO public.notifications (user_id, title, message, category, link_url)
VALUES (
  'ef136c59-2f97-4e09-a25a-1803a32ab497',
  'Refund processed: $10.00 from iHikeDogs LLC',
  '10,000 PawBucks have been credited back to your wallet. Tap to view the full refund timeline and your updated balance.',
  'transaction',
  '/pawbucks/wallet'
);