-- Ensure a user can only have one redemption row per offer.
-- Safe because existing flows already generate exactly one code per (offer, user).
CREATE UNIQUE INDEX IF NOT EXISTS offer_redemptions_offer_user_unique
  ON public.offer_redemptions (offer_id, user_id);