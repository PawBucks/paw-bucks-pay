
-- Merchant Loyalty Programs (punch card style)
CREATE TABLE public.merchant_loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  emoji TEXT DEFAULT '⭐',
  punches_required INTEGER NOT NULL CHECK (punches_required >= 2 AND punches_required <= 100),
  reward_description TEXT NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'free_service',
  qualifying_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Customer punch cards (one per user per program)
CREATE TABLE public.customer_punch_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.merchant_loyalty_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  current_punches INTEGER NOT NULL DEFAULT 0,
  total_punches_earned INTEGER NOT NULL DEFAULT 0,
  cards_completed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(program_id, user_id)
);

-- Individual punch events (audit trail)
CREATE TABLE public.punch_card_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_card_id UUID NOT NULL REFERENCES public.customer_punch_cards(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id),
  event_type TEXT NOT NULL DEFAULT 'punch',
  punches_added INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Loyalty reward redemptions
CREATE TABLE public.loyalty_reward_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  punch_card_id UUID NOT NULL REFERENCES public.customer_punch_cards(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.merchant_loyalty_programs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'available',
  redeemed_at TIMESTAMPTZ,
  redeemed_transaction_id UUID REFERENCES public.transactions(id),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_loyalty_programs_merchant ON public.merchant_loyalty_programs(merchant_id);
CREATE INDEX idx_punch_cards_user ON public.customer_punch_cards(user_id);
CREATE INDEX idx_punch_cards_merchant ON public.customer_punch_cards(merchant_id);
CREATE INDEX idx_punch_cards_program ON public.customer_punch_cards(program_id);
CREATE INDEX idx_punch_events_card ON public.punch_card_events(punch_card_id);
CREATE INDEX idx_loyalty_redemptions_user ON public.loyalty_reward_redemptions(user_id);
CREATE INDEX idx_loyalty_redemptions_merchant ON public.loyalty_reward_redemptions(merchant_id);

-- Updated at triggers
CREATE TRIGGER update_merchant_loyalty_programs_updated_at
  BEFORE UPDATE ON public.merchant_loyalty_programs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_punch_cards_updated_at
  BEFORE UPDATE ON public.customer_punch_cards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.merchant_loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_punch_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.punch_card_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_reward_redemptions ENABLE ROW LEVEL SECURITY;

-- Programs: public read for active, merchant manages own
CREATE POLICY "Anyone can view active loyalty programs"
  ON public.merchant_loyalty_programs FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants manage own loyalty programs"
  ON public.merchant_loyalty_programs FOR ALL
  TO authenticated
  USING (user_owns_merchant(merchant_id))
  WITH CHECK (user_owns_merchant(merchant_id));

-- Punch cards: users see own, merchants see their customers'
CREATE POLICY "Users view own punch cards"
  ON public.customer_punch_cards FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants view their punch cards"
  ON public.customer_punch_cards FOR SELECT
  TO authenticated
  USING (user_owns_merchant(merchant_id));

CREATE POLICY "Service role manages punch cards"
  ON public.customer_punch_cards FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Punch events: users see own, merchants see their events
CREATE POLICY "Users view own punch events"
  ON public.punch_card_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_punch_cards pc
      WHERE pc.id = punch_card_id AND pc.user_id = auth.uid()
    )
  );

CREATE POLICY "Merchants view their punch events"
  ON public.punch_card_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.customer_punch_cards pc
      WHERE pc.id = punch_card_id AND user_owns_merchant(pc.merchant_id)
    )
  );

CREATE POLICY "Service role manages punch events"
  ON public.punch_card_events FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Redemptions: users see own, merchants see their redemptions
CREATE POLICY "Users view own redemptions"
  ON public.loyalty_reward_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants view their redemptions"
  ON public.loyalty_reward_redemptions FOR SELECT
  TO authenticated
  USING (user_owns_merchant(merchant_id));

CREATE POLICY "Service role manages redemptions"
  ON public.loyalty_reward_redemptions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
