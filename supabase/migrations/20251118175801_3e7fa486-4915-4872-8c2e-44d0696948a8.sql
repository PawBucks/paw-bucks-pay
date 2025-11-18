-- Update partner_offers table with all required fields
ALTER TABLE partner_offers
ADD COLUMN IF NOT EXISTS cash_equivalent NUMERIC,
ADD COLUMN IF NOT EXISTS product_id UUID,
ADD COLUMN IF NOT EXISTS image_url TEXT,
ADD COLUMN IF NOT EXISTS start_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS end_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS redemption_cap INTEGER,
ADD COLUMN IF NOT EXISTS redemption_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS per_user_limit INTEGER DEFAULT 1,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft',
ADD COLUMN IF NOT EXISTS require_approval BOOLEAN DEFAULT FALSE;

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_partner_offers_status ON partner_offers(status);
CREATE INDEX IF NOT EXISTS idx_partner_offers_merchant_id ON partner_offers(partner_id);
CREATE INDEX IF NOT EXISTS idx_partner_offers_start_date ON partner_offers(start_date);

-- Create offer_redemptions table
CREATE TABLE IF NOT EXISTS offer_redemptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES partner_offers(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  redemption_code TEXT UNIQUE NOT NULL,
  redeemed_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  partner_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_redemptions_offer_id ON offer_redemptions(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_user_id ON offer_redemptions(user_id);
CREATE INDEX IF NOT EXISTS idx_offer_redemptions_code ON offer_redemptions(redemption_code);

-- Create offer_activity table for audit logging
CREATE TABLE IF NOT EXISTS offer_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  offer_id UUID NOT NULL REFERENCES partner_offers(id) ON DELETE CASCADE,
  merchant_id UUID NOT NULL REFERENCES merchants(id) ON DELETE CASCADE,
  action TEXT NOT NULL,
  actor_id UUID NOT NULL,
  details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_offer_activity_offer_id ON offer_activity(offer_id);
CREATE INDEX IF NOT EXISTS idx_offer_activity_merchant_id ON offer_activity(merchant_id);

-- Enable RLS on new tables
ALTER TABLE offer_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE offer_activity ENABLE ROW LEVEL SECURITY;

-- RLS Policies for offer_redemptions
CREATE POLICY "Users can view their own redemptions"
ON offer_redemptions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Merchants can view redemptions for their offers"
ON offer_redemptions FOR SELECT
USING (offer_id IN (
  SELECT id FROM partner_offers 
  WHERE partner_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  )
));

CREATE POLICY "System can insert redemptions"
ON offer_redemptions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Merchants can update redemptions for their offers"
ON offer_redemptions FOR UPDATE
USING (offer_id IN (
  SELECT id FROM partner_offers 
  WHERE partner_id IN (
    SELECT id FROM merchants WHERE user_id = auth.uid()
  )
));

-- RLS Policies for offer_activity
CREATE POLICY "Merchants can view their offer activity"
ON offer_activity FOR SELECT
USING (merchant_id IN (
  SELECT id FROM merchants WHERE user_id = auth.uid()
));

CREATE POLICY "Admins can view all offer activity"
ON offer_activity FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "System can insert offer activity"
ON offer_activity FOR INSERT
WITH CHECK (true);

-- Function to generate unique redemption code
CREATE OR REPLACE FUNCTION generate_redemption_code()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    code := 'PBK-' || upper(substr(md5(random()::text), 1, 8));
    SELECT EXISTS(SELECT 1 FROM offer_redemptions WHERE redemption_code = code) INTO code_exists;
    EXIT WHEN NOT code_exists;
  END LOOP;
  RETURN code;
END;
$$;

-- Function to check if offer is active and valid
CREATE OR REPLACE FUNCTION is_offer_valid(offer_uuid UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  offer_record RECORD;
BEGIN
  SELECT * INTO offer_record FROM partner_offers WHERE id = offer_uuid;
  
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  -- Check if active
  IF offer_record.status != 'active' OR offer_record.is_active != true THEN
    RETURN FALSE;
  END IF;
  
  -- Check date range
  IF offer_record.start_date IS NOT NULL AND now() < offer_record.start_date THEN
    RETURN FALSE;
  END IF;
  
  IF offer_record.end_date IS NOT NULL AND now() > offer_record.end_date THEN
    RETURN FALSE;
  END IF;
  
  -- Check redemption cap
  IF offer_record.redemption_cap IS NOT NULL AND offer_record.redemption_count >= offer_record.redemption_cap THEN
    RETURN FALSE;
  END IF;
  
  RETURN TRUE;
END;
$$;