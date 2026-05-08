ALTER TABLE public.pawbucks_activity
  ADD COLUMN IF NOT EXISTS offer_id uuid REFERENCES public.partner_offers(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pawbucks_activity_offer_id
  ON public.pawbucks_activity(offer_id) WHERE offer_id IS NOT NULL;