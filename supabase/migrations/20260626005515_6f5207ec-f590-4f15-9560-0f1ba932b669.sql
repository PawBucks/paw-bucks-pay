
ALTER TABLE public.partner_offers
  ADD COLUMN IF NOT EXISTS accepts_pawbucks boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS accepts_usd boolean NOT NULL DEFAULT false;

-- Backfill: existing pawbucks_redemption offers continue to accept PawBucks only.
UPDATE public.partner_offers
  SET accepts_pawbucks = true
  WHERE offer_type = 'pawbucks_redemption' AND accepts_pawbucks IS DISTINCT FROM true;

-- New customer deals don't require either payment method (unlock-based).
UPDATE public.partner_offers
  SET accepts_pawbucks = false, accepts_usd = false
  WHERE offer_type = 'new_customer';

-- Enforce: at least one method for redemption-style offers.
ALTER TABLE public.partner_offers
  DROP CONSTRAINT IF EXISTS partner_offers_payment_method_required;
ALTER TABLE public.partner_offers
  ADD CONSTRAINT partner_offers_payment_method_required
  CHECK (offer_type <> 'pawbucks_redemption' OR accepts_pawbucks OR accepts_usd);
