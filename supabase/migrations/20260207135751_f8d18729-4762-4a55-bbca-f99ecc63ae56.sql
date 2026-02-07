-- =============================================
-- GUILT-FREE SPLURGE BADGES SYSTEM
-- Gamification feature that turns spending guilt into collectible badges
-- =============================================

-- Badge definitions - the different types of badges users can earn
CREATE TABLE public.guilt_badge_definitions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  badge_key TEXT NOT NULL UNIQUE, -- e.g., 'treat_bandit', 'party_pup'
  name TEXT NOT NULL, -- Display name
  description TEXT NOT NULL, -- What the badge represents
  emoji TEXT NOT NULL, -- Badge emoji
  icon_url TEXT, -- Optional custom icon
  category TEXT NOT NULL, -- spending category this tracks (e.g., 'treats', 'toys')
  threshold_amount NUMERIC(10,2) NOT NULL, -- Amount needed to unlock (e.g., 20.00)
  threshold_period TEXT NOT NULL DEFAULT 'week', -- 'day', 'week', 'month'
  reward_type TEXT, -- 'percentage_discount', 'fixed_amount', 'pawbucks_bonus'
  reward_value NUMERIC(10,2), -- The discount/bonus amount
  reward_duration_hours INTEGER DEFAULT 48, -- How long reward lasts
  reward_description TEXT, -- Human readable reward description
  is_active BOOLEAN NOT NULL DEFAULT true,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- User earned badges - tracks which badges users have earned
CREATE TABLE public.user_guilt_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.guilt_badge_definitions(id) ON DELETE CASCADE,
  earned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  spending_amount NUMERIC(10,2) NOT NULL, -- Amount spent to earn this badge
  period_start TIMESTAMP WITH TIME ZONE NOT NULL, -- Start of the tracking period
  period_end TIMESTAMP WITH TIME ZONE NOT NULL, -- End of the tracking period
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  reward_claimed_at TIMESTAMP WITH TIME ZONE,
  reward_expires_at TIMESTAMP WITH TIME ZONE, -- When the reward expires
  metadata JSONB DEFAULT '{}', -- Additional data like transaction IDs
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Badge rewards - tracks active/used rewards from badges
CREATE TABLE public.guilt_badge_rewards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.guilt_badge_definitions(id) ON DELETE CASCADE,
  user_badge_id UUID NOT NULL REFERENCES public.user_guilt_badges(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL,
  reward_value NUMERIC(10,2) NOT NULL,
  reward_code TEXT, -- Optional discount code
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'used', 'expired'
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  used_at TIMESTAMP WITH TIME ZONE,
  used_on_transaction_id UUID,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Badge progress tracking - tracks current progress towards badges
CREATE TABLE public.guilt_badge_progress (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id UUID NOT NULL REFERENCES public.guilt_badge_definitions(id) ON DELETE CASCADE,
  current_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  period_start TIMESTAMP WITH TIME ZONE NOT NULL,
  period_end TIMESTAMP WITH TIME ZONE NOT NULL,
  last_updated TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, badge_id, period_start)
);

-- Create indexes for performance
CREATE INDEX idx_user_guilt_badges_user_id ON public.user_guilt_badges(user_id);
CREATE INDEX idx_user_guilt_badges_badge_id ON public.user_guilt_badges(badge_id);
CREATE INDEX idx_user_guilt_badges_earned_at ON public.user_guilt_badges(earned_at DESC);
CREATE INDEX idx_guilt_badge_rewards_user_id ON public.guilt_badge_rewards(user_id);
CREATE INDEX idx_guilt_badge_rewards_status ON public.guilt_badge_rewards(status);
CREATE INDEX idx_guilt_badge_progress_user_period ON public.guilt_badge_progress(user_id, period_start);

-- Enable RLS
ALTER TABLE public.guilt_badge_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_guilt_badges ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guilt_badge_rewards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.guilt_badge_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies for badge definitions (public read)
CREATE POLICY "Anyone can view active badge definitions"
  ON public.guilt_badge_definitions
  FOR SELECT
  USING (is_active = true);

-- RLS Policies for user badges (users see their own)
CREATE POLICY "Users can view their own badges"
  ON public.user_guilt_badges
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage user badges"
  ON public.user_guilt_badges
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for badge rewards
CREATE POLICY "Users can view their own rewards"
  ON public.guilt_badge_rewards
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own rewards"
  ON public.guilt_badge_rewards
  FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage rewards"
  ON public.guilt_badge_rewards
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- RLS Policies for badge progress
CREATE POLICY "Users can view their own progress"
  ON public.guilt_badge_progress
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage progress"
  ON public.guilt_badge_progress
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Enable realtime for badge updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_guilt_badges;
ALTER PUBLICATION supabase_realtime ADD TABLE public.guilt_badge_rewards;

-- Insert default badge definitions
INSERT INTO public.guilt_badge_definitions (badge_key, name, description, emoji, category, threshold_amount, threshold_period, reward_type, reward_value, reward_duration_hours, reward_description, display_order) VALUES
('treat_bandit', 'Treat Bandit', 'Spent $20+ on treats this week', '🍗', 'treats', 20.00, 'week', 'percentage_discount', 10, 48, '10% off chew toys for 48hrs', 1),
('party_pup', 'Party Pup', 'Spent $50+ on toys or seasonal items', '🎈', 'toys', 50.00, 'week', 'percentage_discount', 15, 48, '15% off next grooming for 48hrs', 2),
('pampered_pet', 'Pampered Pet', 'Spent $75+ on grooming this month', '✨', 'grooming', 75.00, 'month', 'pawbucks_bonus', 100, 72, 'Bonus 100 PawBucks', 3),
('health_hero', 'Health Hero', 'Spent $100+ on vet visits this month', '💊', 'veterinary', 100.00, 'month', 'percentage_discount', 5, 168, '5% off next vet visit for 1 week', 4),
('fashion_forward', 'Fashion Forward', 'Spent $30+ on accessories this week', '🎀', 'accessories', 30.00, 'week', 'pawbucks_bonus', 50, 48, 'Bonus 50 PawBucks', 5),
('snack_attack', 'Snack Attack', 'Spent $40+ on food & treats this week', '🦴', 'food', 40.00, 'week', 'percentage_discount', 8, 48, '8% off pet food for 48hrs', 6);

-- Trigger to update timestamps
CREATE TRIGGER update_guilt_badge_definitions_updated_at
  BEFORE UPDATE ON public.guilt_badge_definitions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_guilt_badge_rewards_updated_at
  BEFORE UPDATE ON public.guilt_badge_rewards
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();