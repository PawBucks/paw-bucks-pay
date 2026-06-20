ALTER TABLE public.partner_offers ADD COLUMN IF NOT EXISTS offer_type text NOT NULL DEFAULT 'pawbucks_redemption';
ALTER TABLE public.partner_offers DROP CONSTRAINT IF EXISTS partner_offers_offer_type_check;
ALTER TABLE public.partner_offers ADD CONSTRAINT partner_offers_offer_type_check CHECK (offer_type IN ('pawbucks_redemption','new_customer'));
CREATE INDEX IF NOT EXISTS idx_partner_offers_offer_type ON public.partner_offers(offer_type);