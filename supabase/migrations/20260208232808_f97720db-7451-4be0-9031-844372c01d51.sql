-- ===========================================================================
-- 50,000 PawBucks Welcome Credit System
-- ===========================================================================

-- Add merchant opt-in flag for welcome credit acceptance
ALTER TABLE public.merchants 
ADD COLUMN IF NOT EXISTS accepts_welcome_credit BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS welcome_credit_opted_in_at TIMESTAMP WITH TIME ZONE;

-- Create welcome credit tracking table
CREATE TABLE public.user_welcome_credits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  credit_amount INTEGER NOT NULL DEFAULT 50000,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'used', 'expired', 'revoked')),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_with_merchant_id UUID REFERENCES public.merchants(id),
  used_in_transaction_id UUID,
  transaction_total_cents INTEGER,
  device_fingerprint TEXT,
  ip_address TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  revocation_reason TEXT,
  UNIQUE(user_id) -- One credit per user
);

-- Create abuse prevention tracking table
CREATE TABLE public.welcome_credit_abuse_signals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  signal_type TEXT NOT NULL CHECK (signal_type IN ('duplicate_payment_method', 'rapid_signup', 'device_fingerprint_match', 'household_match', 'suspicious_pattern')),
  signal_data JSONB,
  severity TEXT NOT NULL DEFAULT 'low' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create welcome credit reminder log
CREATE TABLE public.welcome_credit_reminders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  welcome_credit_id UUID NOT NULL REFERENCES public.user_welcome_credits(id) ON DELETE CASCADE,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('14_days', '7_days', '48_hours')),
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  channel TEXT NOT NULL DEFAULT 'in_app' CHECK (channel IN ('in_app', 'email', 'push')),
  UNIQUE(welcome_credit_id, reminder_type, channel)
);

-- Create welcome credit analytics table for tracking metrics
CREATE TABLE public.welcome_credit_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('credit_issued', 'credit_used', 'credit_expired', 'credit_revoked', 'merchant_opted_in', 'merchant_opted_out', 'abuse_detected')),
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  event_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.user_welcome_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_credit_abuse_signals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_credit_reminders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.welcome_credit_analytics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for user_welcome_credits
CREATE POLICY "Users can view their own welcome credit"
  ON public.user_welcome_credits
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage welcome credits"
  ON public.user_welcome_credits
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- RLS Policies for abuse signals (admin only)
CREATE POLICY "Admins can view abuse signals"
  ON public.welcome_credit_abuse_signals
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- RLS Policies for reminders
CREATE POLICY "Users can view their own reminders"
  ON public.welcome_credit_reminders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_welcome_credits uwc
      WHERE uwc.id = welcome_credit_id AND uwc.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage reminders"
  ON public.welcome_credit_reminders
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- RLS Policies for analytics (admin only)
CREATE POLICY "Admins can view analytics"
  ON public.welcome_credit_analytics
  FOR ALL
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Function to check if user is eligible for welcome credit
CREATE OR REPLACE FUNCTION public.check_welcome_credit_eligibility(p_user_id UUID, p_merchant_id UUID)
RETURNS TABLE(
  is_eligible BOOLEAN,
  reason TEXT,
  credit_amount INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_has_credit RECORD;
  v_has_transactions BOOLEAN;
  v_has_merchant_transactions BOOLEAN;
  v_merchant_accepts BOOLEAN;
BEGIN
  -- Check if user has an active welcome credit
  SELECT * INTO v_has_credit
  FROM user_welcome_credits
  WHERE user_id = p_user_id
  LIMIT 1;
  
  -- If no credit exists, they never got one (issue it)
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 'No welcome credit issued'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check credit status
  IF v_has_credit.status = 'used' THEN
    RETURN QUERY SELECT FALSE, 'Welcome credit already used'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_has_credit.status = 'expired' THEN
    RETURN QUERY SELECT FALSE, 'Welcome credit has expired'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  IF v_has_credit.status = 'revoked' THEN
    RETURN QUERY SELECT FALSE, 'Welcome credit was revoked'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check if credit is expired by date
  IF v_has_credit.expires_at < now() THEN
    -- Mark as expired
    UPDATE user_welcome_credits SET status = 'expired', updated_at = now() WHERE id = v_has_credit.id;
    RETURN QUERY SELECT FALSE, 'Welcome credit has expired'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check if user has any previous transactions
  SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id = p_user_id) INTO v_has_transactions;
  IF v_has_transactions THEN
    RETURN QUERY SELECT FALSE, 'Not eligible - not first transaction'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check if user has transacted with this merchant before
  SELECT EXISTS(SELECT 1 FROM transactions WHERE user_id = p_user_id AND merchant_id = p_merchant_id) INTO v_has_merchant_transactions;
  IF v_has_merchant_transactions THEN
    RETURN QUERY SELECT FALSE, 'Not eligible - not first transaction with merchant'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- Check if merchant accepts welcome credit
  SELECT accepts_welcome_credit INTO v_merchant_accepts FROM merchants WHERE id = p_merchant_id;
  IF NOT v_merchant_accepts THEN
    RETURN QUERY SELECT FALSE, 'Merchant does not accept welcome credit'::TEXT, 0, NULL::TIMESTAMP WITH TIME ZONE;
    RETURN;
  END IF;
  
  -- All checks passed
  RETURN QUERY SELECT TRUE, 'Eligible'::TEXT, v_has_credit.credit_amount, v_has_credit.expires_at;
END;
$$;

-- Function to issue welcome credit to new user
CREATE OR REPLACE FUNCTION public.issue_welcome_credit(p_user_id UUID, p_device_fingerprint TEXT DEFAULT NULL, p_ip_address TEXT DEFAULT NULL)
RETURNS TABLE(
  success BOOLEAN,
  credit_id UUID,
  credit_amount INTEGER,
  expires_at TIMESTAMP WITH TIME ZONE,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_credit RECORD;
  v_new_credit_id UUID;
  v_expires_at TIMESTAMP WITH TIME ZONE;
BEGIN
  -- Check if user already has a credit
  SELECT * INTO v_existing_credit FROM user_welcome_credits WHERE user_id = p_user_id;
  
  IF FOUND THEN
    RETURN QUERY SELECT FALSE, v_existing_credit.id, v_existing_credit.credit_amount, v_existing_credit.expires_at, 'Welcome credit already exists'::TEXT;
    RETURN;
  END IF;
  
  -- Check for abuse signals (device fingerprint matches)
  IF p_device_fingerprint IS NOT NULL THEN
    IF EXISTS(
      SELECT 1 FROM user_welcome_credits 
      WHERE device_fingerprint = p_device_fingerprint 
      AND status IN ('used', 'active')
    ) THEN
      -- Log abuse signal
      INSERT INTO welcome_credit_abuse_signals (user_id, signal_type, signal_data, severity)
      VALUES (p_user_id, 'device_fingerprint_match', jsonb_build_object('fingerprint', p_device_fingerprint), 'high');
      
      RETURN QUERY SELECT FALSE, NULL::UUID, 0, NULL::TIMESTAMP WITH TIME ZONE, 'Not eligible for welcome credit'::TEXT;
      RETURN;
    END IF;
  END IF;
  
  -- Set expiration to 45 days from now
  v_expires_at := now() + INTERVAL '45 days';
  
  -- Issue the credit
  INSERT INTO user_welcome_credits (user_id, credit_amount, expires_at, device_fingerprint, ip_address)
  VALUES (p_user_id, 50000, v_expires_at, p_device_fingerprint, p_ip_address)
  RETURNING id INTO v_new_credit_id;
  
  -- Log analytics event
  INSERT INTO welcome_credit_analytics (event_type, user_id, event_data)
  VALUES ('credit_issued', p_user_id, jsonb_build_object('credit_id', v_new_credit_id, 'amount', 50000, 'expires_at', v_expires_at));
  
  RETURN QUERY SELECT TRUE, v_new_credit_id, 50000, v_expires_at, 'Welcome credit issued successfully'::TEXT;
END;
$$;

-- Function to redeem welcome credit
CREATE OR REPLACE FUNCTION public.redeem_welcome_credit(
  p_user_id UUID, 
  p_merchant_id UUID, 
  p_transaction_total_cents INTEGER,
  p_transaction_id UUID DEFAULT NULL
)
RETURNS TABLE(
  success BOOLEAN,
  credit_applied INTEGER,
  message TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_credit RECORD;
  v_min_transaction_cents INTEGER := 7500; -- $75 minimum
BEGIN
  -- Check minimum transaction amount
  IF p_transaction_total_cents < v_min_transaction_cents THEN
    RETURN QUERY SELECT FALSE, 0, 'Minimum transaction of $75 required to use welcome credit'::TEXT;
    RETURN;
  END IF;
  
  -- Get user's active welcome credit
  SELECT * INTO v_credit
  FROM user_welcome_credits
  WHERE user_id = p_user_id AND status = 'active'
  FOR UPDATE;
  
  IF NOT FOUND THEN
    RETURN QUERY SELECT FALSE, 0, 'No active welcome credit found'::TEXT;
    RETURN;
  END IF;
  
  -- Verify merchant accepts welcome credit
  IF NOT EXISTS(SELECT 1 FROM merchants WHERE id = p_merchant_id AND accepts_welcome_credit = true) THEN
    RETURN QUERY SELECT FALSE, 0, 'Merchant does not accept welcome credit'::TEXT;
    RETURN;
  END IF;
  
  -- Check expiration
  IF v_credit.expires_at < now() THEN
    UPDATE user_welcome_credits SET status = 'expired', updated_at = now() WHERE id = v_credit.id;
    RETURN QUERY SELECT FALSE, 0, 'Welcome credit has expired'::TEXT;
    RETURN;
  END IF;
  
  -- Apply the credit (capped at transaction total)
  -- Credit cannot exceed transaction total
  DECLARE
    v_credit_to_apply INTEGER;
  BEGIN
    v_credit_to_apply := LEAST(v_credit.credit_amount, p_transaction_total_cents);
    
    -- Mark credit as used
    UPDATE user_welcome_credits
    SET 
      status = 'used',
      used_at = now(),
      used_with_merchant_id = p_merchant_id,
      used_in_transaction_id = p_transaction_id,
      transaction_total_cents = p_transaction_total_cents,
      updated_at = now()
    WHERE id = v_credit.id;
    
    -- Log analytics
    INSERT INTO welcome_credit_analytics (event_type, user_id, merchant_id, event_data)
    VALUES ('credit_used', p_user_id, p_merchant_id, jsonb_build_object(
      'credit_id', v_credit.id,
      'credit_applied', v_credit_to_apply,
      'transaction_total', p_transaction_total_cents,
      'transaction_id', p_transaction_id
    ));
    
    RETURN QUERY SELECT TRUE, v_credit_to_apply, 'Welcome credit applied successfully'::TEXT;
  END;
END;
$$;

-- Trigger to update updated_at
CREATE TRIGGER update_welcome_credits_updated_at
  BEFORE UPDATE ON public.user_welcome_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Index for faster lookups
CREATE INDEX idx_welcome_credits_user_status ON public.user_welcome_credits(user_id, status);
CREATE INDEX idx_welcome_credits_expires_at ON public.user_welcome_credits(expires_at) WHERE status = 'active';
CREATE INDEX idx_welcome_credit_analytics_event ON public.welcome_credit_analytics(event_type, created_at);
CREATE INDEX idx_merchants_accepts_welcome ON public.merchants(accepts_welcome_credit) WHERE accepts_welcome_credit = true;