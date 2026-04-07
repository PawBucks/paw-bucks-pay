
-- Add QR token columns to merchants and partner_vets
ALTER TABLE public.merchants ADD COLUMN IF NOT EXISTS checkin_qr_token TEXT UNIQUE;
ALTER TABLE public.partner_vets ADD COLUMN IF NOT EXISTS checkin_qr_token TEXT UNIQUE;

-- Function to generate unique QR tokens
CREATE OR REPLACE FUNCTION public.generate_checkin_qr_token()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  token TEXT;
  token_exists BOOLEAN;
BEGIN
  LOOP
    token := 'CHK-' || upper(substr(md5(random()::text || clock_timestamp()::text), 1, 12));
    SELECT EXISTS(
      SELECT 1 FROM merchants WHERE checkin_qr_token = token
      UNION ALL
      SELECT 1 FROM partner_vets WHERE checkin_qr_token = token
    ) INTO token_exists;
    EXIT WHEN NOT token_exists;
  END LOOP;
  RETURN token;
END;
$$;

-- Auto-assign QR tokens to merchants on insert (if not set)
CREATE OR REPLACE FUNCTION public.set_merchant_checkin_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checkin_qr_token IS NULL THEN
    NEW.checkin_qr_token := generate_checkin_qr_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_merchant_checkin_token_trigger
BEFORE INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.set_merchant_checkin_token();

-- Auto-assign QR tokens to vets on insert (if not set)
CREATE OR REPLACE FUNCTION public.set_vet_checkin_token()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.checkin_qr_token IS NULL THEN
    NEW.checkin_qr_token := generate_checkin_qr_token();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_vet_checkin_token_trigger
BEFORE INSERT ON public.partner_vets
FOR EACH ROW
EXECUTE FUNCTION public.set_vet_checkin_token();

-- Backfill existing merchants and vets with QR tokens
UPDATE public.merchants SET checkin_qr_token = generate_checkin_qr_token() WHERE checkin_qr_token IS NULL;
UPDATE public.partner_vets SET checkin_qr_token = generate_checkin_qr_token() WHERE checkin_qr_token IS NULL;

-- Create the checkins table
CREATE TABLE public.checkins (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE CASCADE,
  vet_id UUID REFERENCES public.partner_vets(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  checkin_token TEXT NOT NULL,
  checked_in_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  CONSTRAINT checkin_has_entity CHECK (merchant_id IS NOT NULL OR vet_id IS NOT NULL)
);

-- Indexes
CREATE INDEX idx_checkins_merchant_id ON public.checkins(merchant_id);
CREATE INDEX idx_checkins_vet_id ON public.checkins(vet_id);
CREATE INDEX idx_checkins_user_id ON public.checkins(user_id);
CREATE INDEX idx_checkins_checked_in_at ON public.checkins(checked_in_at);

-- Enable RLS
ALTER TABLE public.checkins ENABLE ROW LEVEL SECURITY;

-- Merchants can view their own check-ins
CREATE POLICY "Merchants can view their check-ins"
ON public.checkins FOR SELECT
USING (
  merchant_id IS NOT NULL AND
  EXISTS (SELECT 1 FROM merchants m WHERE m.id = checkins.merchant_id AND m.user_id = auth.uid())
);

-- Vets can view their own check-ins
CREATE POLICY "Vets can view their check-ins"
ON public.checkins FOR SELECT
USING (
  vet_id IS NOT NULL AND
  EXISTS (SELECT 1 FROM partner_vets pv WHERE pv.id = checkins.vet_id AND pv.user_id = auth.uid())
);

-- Pet owners can view their own check-ins
CREATE POLICY "Users can view their own check-ins"
ON public.checkins FOR SELECT
USING (user_id = auth.uid());

-- Authenticated users can create check-ins
CREATE POLICY "Authenticated users can create check-ins"
ON public.checkins FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Function to process a check-in via QR token
CREATE OR REPLACE FUNCTION public.process_checkin(p_token TEXT, p_user_id UUID)
RETURNS TABLE(success BOOLEAN, entity_name TEXT, entity_type TEXT, message TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_merchant RECORD;
  v_vet RECORD;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Check merchants first
  SELECT id, business_name INTO v_merchant FROM merchants WHERE checkin_qr_token = p_token;
  IF FOUND THEN
    -- Check for duplicate today
    IF EXISTS (
      SELECT 1 FROM checkins 
      WHERE merchant_id = v_merchant.id AND user_id = p_user_id 
      AND checked_in_at::date = v_today
    ) THEN
      RETURN QUERY SELECT FALSE, v_merchant.business_name, 'merchant'::TEXT, 'You have already checked in today'::TEXT;
      RETURN;
    END IF;
    
    INSERT INTO checkins (merchant_id, user_id, checkin_token)
    VALUES (v_merchant.id, p_user_id, p_token);
    
    RETURN QUERY SELECT TRUE, v_merchant.business_name, 'merchant'::TEXT, 'Successfully checked in!'::TEXT;
    RETURN;
  END IF;
  
  -- Check vets
  SELECT id, clinic_name, name INTO v_vet FROM partner_vets WHERE checkin_qr_token = p_token;
  IF FOUND THEN
    IF EXISTS (
      SELECT 1 FROM checkins 
      WHERE vet_id = v_vet.id AND user_id = p_user_id 
      AND checked_in_at::date = v_today
    ) THEN
      RETURN QUERY SELECT FALSE, COALESCE(v_vet.clinic_name, v_vet.name), 'vet'::TEXT, 'You have already checked in today'::TEXT;
      RETURN;
    END IF;
    
    INSERT INTO checkins (vet_id, user_id, checkin_token)
    VALUES (v_vet.id, p_user_id, p_token);
    
    RETURN QUERY SELECT TRUE, COALESCE(v_vet.clinic_name, v_vet.name), 'vet'::TEXT, 'Successfully checked in!'::TEXT;
    RETURN;
  END IF;
  
  RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, 'Invalid QR code'::TEXT;
END;
$$;
