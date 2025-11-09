-- Create PawBucks Wallet table
CREATE TABLE IF NOT EXISTS public.pawbucks_wallet (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  CONSTRAINT unique_user_wallet UNIQUE(user_id)
);

-- Create PawBucks Activity table
CREATE TABLE IF NOT EXISTS public.pawbucks_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('earn', 'redeem')),
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  partner_id UUID REFERENCES public.merchants(id),
  transaction_id UUID REFERENCES public.transactions(id),
  redemption_code TEXT,
  redemption_used BOOLEAN DEFAULT false,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create Partner Offers table
CREATE TABLE IF NOT EXISTS public.partner_offers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  coins_required INTEGER NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pawbucks_wallet ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pawbucks_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partner_offers ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pawbucks_wallet
CREATE POLICY "Users can view their own wallet"
  ON public.pawbucks_wallet FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own wallet"
  ON public.pawbucks_wallet FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert wallets"
  ON public.pawbucks_wallet FOR INSERT
  WITH CHECK (true);

-- RLS Policies for pawbucks_activity
CREATE POLICY "Users can view their own activity"
  ON public.pawbucks_activity FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can insert activity"
  ON public.pawbucks_activity FOR INSERT
  WITH CHECK (true);

-- RLS Policies for partner_offers
CREATE POLICY "Everyone can view active offers"
  ON public.partner_offers FOR SELECT
  USING (is_active = true);

CREATE POLICY "Merchants can manage their offers"
  ON public.partner_offers FOR ALL
  USING (partner_id IN (SELECT id FROM merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage all offers"
  ON public.partner_offers FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_pawbucks_wallet_user_id ON public.pawbucks_wallet(user_id);
CREATE INDEX idx_pawbucks_activity_user_id ON public.pawbucks_activity(user_id);
CREATE INDEX idx_pawbucks_activity_created_at ON public.pawbucks_activity(created_at DESC);
CREATE INDEX idx_partner_offers_partner_id ON public.partner_offers(partner_id);
CREATE INDEX idx_partner_offers_active ON public.partner_offers(is_active) WHERE is_active = true;

-- Trigger to update last_updated on wallet changes
CREATE OR REPLACE FUNCTION update_pawbucks_wallet_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER pawbucks_wallet_updated
  BEFORE UPDATE ON public.pawbucks_wallet
  FOR EACH ROW
  EXECUTE FUNCTION update_pawbucks_wallet_timestamp();

-- Trigger to update updated_at on offers
CREATE TRIGGER update_partner_offers_timestamp
  BEFORE UPDATE ON public.partner_offers
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Function to create wallet for new users
CREATE OR REPLACE FUNCTION create_pawbucks_wallet_for_user()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_type = 'pet_owner' THEN
    INSERT INTO public.pawbucks_wallet (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER create_pawbucks_wallet_on_profile
  AFTER INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION create_pawbucks_wallet_for_user();