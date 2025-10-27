-- Add referral_code to profiles table
ALTER TABLE public.profiles 
ADD COLUMN referral_code TEXT UNIQUE;

-- Create function to generate unique referral code
CREATE OR REPLACE FUNCTION public.generate_referral_code()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate 8-character alphanumeric code
    code := upper(substr(md5(random()::text), 1, 8));
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE referral_code = code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN code;
END;
$$;

-- Create referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referee_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  referral_code TEXT NOT NULL,
  referrer_bonus_awarded BOOLEAN DEFAULT false,
  referee_bonus_awarded BOOLEAN DEFAULT false,
  referrer_bonus_amount NUMERIC DEFAULT 10.00,
  referee_bonus_amount NUMERIC DEFAULT 10.00,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(referee_id)
);

-- Enable RLS on referrals table
ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

-- RLS policies for referrals
CREATE POLICY "Users can view their own referrals as referrer"
ON public.referrals
FOR SELECT
USING (auth.uid() = referrer_id);

CREATE POLICY "Users can view their own referrals as referee"
ON public.referrals
FOR SELECT
USING (auth.uid() = referee_id);

CREATE POLICY "Users can insert their own referral record"
ON public.referrals
FOR INSERT
WITH CHECK (auth.uid() = referee_id);

-- Update existing profiles to have referral codes
UPDATE public.profiles
SET referral_code = generate_referral_code()
WHERE referral_code IS NULL;

-- Function to set referral code on new profiles
CREATE OR REPLACE FUNCTION public.set_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.referral_code IS NULL THEN
    NEW.referral_code := generate_referral_code();
  END IF;
  RETURN NEW;
END;
$$;

-- Trigger to set referral code on profile creation
CREATE TRIGGER set_referral_code_trigger
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.set_referral_code();

-- Function to award referral bonuses after first transaction
CREATE OR REPLACE FUNCTION public.award_referral_bonus()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  referral_record RECORD;
BEGIN
  -- Check if this is the referee's first transaction
  IF (SELECT COUNT(*) FROM public.transactions WHERE pet_owner_id = NEW.pet_owner_id) = 1 THEN
    -- Find referral record for this user
    SELECT * INTO referral_record
    FROM public.referrals
    WHERE referee_id = NEW.pet_owner_id
    AND referee_bonus_awarded = false;
    
    IF FOUND THEN
      -- Award bonus to referee
      UPDATE public.wallets
      SET balance = balance + referral_record.referee_bonus_amount
      WHERE user_id = referral_record.referee_id;
      
      -- Award bonus to referrer
      UPDATE public.wallets
      SET balance = balance + referral_record.referrer_bonus_amount
      WHERE user_id = referral_record.referrer_id;
      
      -- Mark bonuses as awarded
      UPDATE public.referrals
      SET 
        referrer_bonus_awarded = true,
        referee_bonus_awarded = true
      WHERE id = referral_record.id;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger to award referral bonuses after transaction
CREATE TRIGGER award_referral_bonus_trigger
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.award_referral_bonus();