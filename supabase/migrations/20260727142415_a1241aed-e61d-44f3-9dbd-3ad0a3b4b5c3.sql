
ALTER TABLE public.offer_redemptions ALTER COLUMN user_id DROP NOT NULL;
DROP INDEX IF EXISTS public.offer_redemptions_offer_user_unique;
CREATE UNIQUE INDEX offer_redemptions_offer_user_unique
  ON public.offer_redemptions (offer_id, user_id)
  WHERE user_id IS NOT NULL AND redeemed_at IS NOT NULL;
