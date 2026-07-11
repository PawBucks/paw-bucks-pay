-- Normalize any legacy offer_type values first
UPDATE public.partner_offers
SET offer_type = 'partner_deal'
WHERE offer_type IS NULL
   OR offer_type NOT IN ('new_customer', 'partner_deal', 'pawbucks_redemption');

-- Enforce allowed set + default going forward
ALTER TABLE public.partner_offers
  ALTER COLUMN offer_type SET DEFAULT 'partner_deal',
  ALTER COLUMN offer_type SET NOT NULL;

ALTER TABLE public.partner_offers
  DROP CONSTRAINT IF EXISTS partner_offers_offer_type_check;

ALTER TABLE public.partner_offers
  ADD CONSTRAINT partner_offers_offer_type_check
  CHECK (offer_type IN ('new_customer', 'partner_deal', 'pawbucks_redemption'));