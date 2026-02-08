-- =====================================================
-- PAWBUCKS LOYALTY SYSTEM - FULL IMPLEMENTATION
-- =====================================================

-- 1. CONSUMER TIER SYSTEM (Silver/Gold/Platinum)
-- =====================================================

-- Create tier enum
CREATE TYPE public.consumer_tier AS ENUM ('silver', 'gold', 'platinum');

-- Consumer tier definitions table
CREATE TABLE public.consumer_tier_definitions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier consumer_tier UNIQUE NOT NULL,
  display_name TEXT NOT NULL,
  emoji TEXT NOT NULL,
  description TEXT NOT NULL,
  -- Qualification requirements
  min_consecutive_months INTEGER NOT NULL DEFAULT 0,
  min_badges_per_year INTEGER NOT NULL DEFAULT 0,
  min_transactions_per_year INTEGER NOT NULL DEFAULT 0,
  -- Benefits
  annual_free_credit_value NUMERIC(10,2) NOT NULL DEFAULT 0,
  priority_offers BOOLEAN NOT NULL DEFAULT false,
  exclusive_perks JSONB DEFAULT '[]'::jsonb,
  reward_multiplier NUMERIC(3,2) NOT NULL DEFAULT 1.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User tier tracking
CREATE TABLE public.user_tier_status (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  current_tier consumer_tier NOT NULL DEFAULT 'silver',
  tier_start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  consecutive_active_months INTEGER NOT NULL DEFAULT 0,
  last_active_month DATE,
  badges_earned_this_year INTEGER NOT NULL DEFAULT 0,
  transactions_this_year INTEGER NOT NULL DEFAULT 0,
  tier_paused BOOLEAN NOT NULL DEFAULT false,
  tier_paused_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tier history for tracking promotions/demotions
CREATE TABLE public.user_tier_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  old_tier consumer_tier,
  new_tier consumer_tier NOT NULL,
  reason TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.consumer_tier_definitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tier_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_tier_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies for tier definitions (public read)
CREATE POLICY "Anyone can view tier definitions"
  ON public.consumer_tier_definitions FOR SELECT
  USING (true);

-- RLS Policies for user tier status
CREATE POLICY "Users can view their own tier status"
  ON public.user_tier_status FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage tier status"
  ON public.user_tier_status FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- RLS Policies for tier history
CREATE POLICY "Users can view their own tier history"
  ON public.user_tier_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 2. LOYAL PET PARENT GUARANTEE (12-Transaction Milestone)
-- =====================================================

CREATE TABLE public.loyalty_milestones (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id),
  milestone_type TEXT NOT NULL DEFAULT 'visits', -- 'visits', 'spending', 'badges'
  target_count INTEGER NOT NULL DEFAULT 12,
  current_count INTEGER NOT NULL DEFAULT 0,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  credit_value NUMERIC(10,2) NOT NULL DEFAULT 50.00,
  platform_contribution NUMERIC(10,2) NOT NULL DEFAULT 25.00, -- 50% split
  merchant_contribution NUMERIC(10,2) NOT NULL DEFAULT 25.00, -- 50% split
  status TEXT NOT NULL DEFAULT 'in_progress', -- 'in_progress', 'completed', 'expired', 'redeemed'
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_milestone_status CHECK (status IN ('in_progress', 'completed', 'expired', 'redeemed'))
);

-- Track qualifying transactions for milestones
CREATE TABLE public.milestone_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  milestone_id UUID NOT NULL REFERENCES public.loyalty_milestones(id) ON DELETE CASCADE,
  transaction_id UUID NOT NULL REFERENCES public.transactions(id),
  transaction_date TIMESTAMPTZ NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_milestones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.milestone_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own milestones"
  ON public.loyalty_milestones FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their milestone transactions"
  ON public.milestone_transactions FOR SELECT
  TO authenticated
  USING (
    milestone_id IN (
      SELECT id FROM public.loyalty_milestones WHERE user_id = auth.uid()
    )
  );

-- 3. FREE SERVICE/PRODUCT CREDITS
-- =====================================================

CREATE TABLE public.service_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  merchant_id UUID REFERENCES public.merchants(id),
  source_type TEXT NOT NULL, -- 'milestone', 'tier_benefit', 'personality_perk', 'badge_collection'
  source_id UUID,
  credit_value NUMERIC(10,2) NOT NULL,
  remaining_value NUMERIC(10,2) NOT NULL,
  description TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'active', -- 'active', 'partially_used', 'used', 'expired'
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_credit_status CHECK (status IN ('active', 'partially_used', 'used', 'expired'))
);

-- Track credit usage
CREATE TABLE public.service_credit_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  credit_id UUID NOT NULL REFERENCES public.service_credits(id),
  transaction_id UUID REFERENCES public.transactions(id),
  amount_used NUMERIC(10,2) NOT NULL,
  used_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.service_credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_credit_usage ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own credits"
  ON public.service_credits FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their credit usage"
  ON public.service_credit_usage FOR SELECT
  TO authenticated
  USING (
    credit_id IN (
      SELECT id FROM public.service_credits WHERE user_id = auth.uid()
    )
  );

-- 4. ENHANCED BADGE SYSTEM WITH FIXED-DOLLAR REWARDS
-- =====================================================

-- Add new columns to existing guilt_badge_definitions
ALTER TABLE public.guilt_badge_definitions
  ADD COLUMN IF NOT EXISTS fixed_reward_amount NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS reward_expires_hours INTEGER DEFAULT 48,
  ADD COLUMN IF NOT EXISTS is_streak_badge BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS collection_id UUID,
  ADD COLUMN IF NOT EXISTS contributes_to_milestone BOOLEAN DEFAULT true;

-- Badge collections (seasonal, themed)
CREATE TABLE public.badge_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  start_date DATE,
  end_date DATE,
  is_seasonal BOOLEAN NOT NULL DEFAULT false,
  completion_reward_type TEXT, -- 'credit', 'pawbucks', 'tier_progress'
  completion_reward_value NUMERIC(10,2),
  completion_reward_description TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User badge streaks
CREATE TABLE public.user_badge_streaks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  streak_type TEXT NOT NULL DEFAULT 'monthly', -- 'weekly', 'monthly'
  current_streak INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  last_earned_date DATE,
  streak_start_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, streak_type)
);

-- User collection progress
CREATE TABLE public.user_badge_collection_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  collection_id UUID NOT NULL REFERENCES public.badge_collections(id),
  badges_earned INTEGER NOT NULL DEFAULT 0,
  total_badges INTEGER NOT NULL,
  completed_at TIMESTAMPTZ,
  reward_claimed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, collection_id)
);

-- Enable RLS
ALTER TABLE public.badge_collections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badge_streaks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badge_collection_progress ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view badge collections"
  ON public.badge_collections FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own badge streaks"
  ON public.user_badge_streaks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view their collection progress"
  ON public.user_badge_collection_progress FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 5. PERSONALITY PERKS SYSTEM
-- =====================================================

CREATE TABLE public.personality_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  personality_type TEXT NOT NULL,
  perk_type TEXT NOT NULL, -- 'annual', 'quarterly', 'monthly', 'one_time'
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  emoji TEXT NOT NULL,
  perk_value NUMERIC(10,2),
  perk_value_type TEXT NOT NULL, -- 'fixed_credit', 'percentage_discount', 'free_service'
  service_category TEXT, -- Which merchant category it applies to
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- User personality perk entitlements
CREATE TABLE public.user_personality_perks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pet_profiles(id),
  perk_id UUID NOT NULL REFERENCES public.personality_perks(id),
  eligible_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'available', -- 'available', 'claimed', 'used', 'expired'
  claimed_at TIMESTAMPTZ,
  used_at TIMESTAMPTZ,
  used_on_transaction_id UUID REFERENCES public.transactions(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT valid_perk_status CHECK (status IN ('available', 'claimed', 'used', 'expired'))
);

-- Enable RLS
ALTER TABLE public.personality_perks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_personality_perks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view personality perks"
  ON public.personality_perks FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own personality perks"
  ON public.user_personality_perks FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. PERSONALITY EVOLUTION SYSTEM
-- =====================================================

CREATE TABLE public.personality_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  base_personality TEXT NOT NULL,
  evolved_personality TEXT NOT NULL,
  evolution_name TEXT NOT NULL, -- e.g., "Zen Guard Dog", "Retired Chaos Mode"
  trigger_type TEXT NOT NULL, -- 'spending_streak', 'activity_pattern', 'badge_completion'
  trigger_threshold JSONB NOT NULL, -- e.g., {"streak_days": 30, "category": "wellness"}
  duration_days INTEGER NOT NULL DEFAULT 30,
  bonus_perks JSONB DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Track active personality evolutions
CREATE TABLE public.user_personality_evolutions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  pet_id UUID REFERENCES public.pet_profiles(id),
  evolution_id UUID NOT NULL REFERENCES public.personality_evolutions(id),
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.personality_evolutions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_personality_evolutions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Anyone can view personality evolutions"
  ON public.personality_evolutions FOR SELECT
  USING (true);

CREATE POLICY "Users can view their own evolutions"
  ON public.user_personality_evolutions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- 7. LEAKAGE PREVENTION TRACKING
-- =====================================================

CREATE TABLE public.loyalty_warnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  warning_type TEXT NOT NULL, -- 'milestone_expiring', 'tier_at_risk', 'perk_expiring', 'streak_breaking'
  message TEXT NOT NULL,
  urgency TEXT NOT NULL DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
  related_entity_type TEXT, -- 'milestone', 'credit', 'perk', 'tier'
  related_entity_id UUID,
  action_deadline TIMESTAMPTZ,
  is_dismissed BOOLEAN NOT NULL DEFAULT false,
  dismissed_at TIMESTAMPTZ,
  notification_sent BOOLEAN NOT NULL DEFAULT false,
  notification_sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.loyalty_warnings ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view their own warnings"
  ON public.loyalty_warnings FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can dismiss their own warnings"
  ON public.loyalty_warnings FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 8. INSERT DEFAULT DATA
-- =====================================================

-- Insert default tier definitions
INSERT INTO public.consumer_tier_definitions (tier, display_name, emoji, description, min_consecutive_months, min_badges_per_year, min_transactions_per_year, annual_free_credit_value, priority_offers, reward_multiplier, exclusive_perks) VALUES
('silver', 'Silver', '🥈', 'Welcome to the pack! Start earning rewards with every purchase.', 0, 0, 0, 0, false, 1.0, '["Early access to new merchant partners"]'),
('gold', 'Gold', '🥇', 'Loyal pet parent! Enjoy enhanced rewards and exclusive perks.', 3, 3, 6, 25.00, true, 1.25, '["Priority customer support", "Exclusive flash sale access", "Birthday bonus for your pet"]'),
('platinum', 'Platinum', '💎', 'VIP status! Maximum rewards and guaranteed free services.', 6, 6, 12, 50.00, true, 1.5, '["Guaranteed free service annually", "VIP merchant access", "Exclusive platinum events", "Personal rewards concierge"]');

-- Insert default personality perks
INSERT INTO public.personality_perks (personality_type, perk_type, name, description, emoji, perk_value, perk_value_type, service_category) VALUES
-- Guard Dog/Cat perks
('Guard Dog', 'annual', 'Free Enrichment Toy', 'One free enrichment toy each year to keep your protector sharp', '🧠', 15.00, 'fixed_credit', 'toys'),
('Guard Dog', 'quarterly', 'Mental Stimulation Week', 'Special access to puzzle toys and brain games at partner stores', '🎯', 10.00, 'percentage_discount', 'toys'),
('Guard Cat', 'annual', 'Free Enrichment Toy', 'One free enrichment toy each year to keep your protector sharp', '🧠', 15.00, 'fixed_credit', 'toys'),
('Guard Cat', 'quarterly', 'Mental Stimulation Week', 'Special access to puzzle toys and brain games at partner stores', '🎯', 10.00, 'percentage_discount', 'toys'),
-- Couch Potato perks
('Couch Potato', 'annual', 'Free Nail Trim', 'Annual complimentary nail trim at partner groomers', '💅', 20.00, 'free_service', 'grooming'),
('Couch Potato', 'quarterly', 'Spa Day Discount', 'Discounted spa and pampering services for your relaxed companion', '🛁', 15.00, 'percentage_discount', 'grooming'),
-- Chaotic Neutral perks
('Chaotic Neutral', 'annual', 'Free Training Session', 'One free training session to channel that chaos energy', '🎓', 30.00, 'free_service', 'training'),
('Chaotic Neutral', 'quarterly', 'Adventure Gear Discount', 'Special pricing on toys that can withstand the chaos', '🌪️', 20.00, 'percentage_discount', 'toys'),
-- Social Butterfly perks
('Social Butterfly', 'annual', 'Free Daycare Day', 'One free day of daycare for your social star', '🦋', 35.00, 'free_service', 'daycare'),
('Social Butterfly', 'quarterly', 'Playdate Bonus', 'Bonus PawBucks when booking group activities', '🎉', 500.00, 'fixed_credit', 'daycare'),
-- Adventurer perks
('Adventurer', 'annual', 'Free Hike Credit', 'One free hike with a partner dog walker', '🏔️', 40.00, 'free_service', 'walking'),
('Adventurer', 'quarterly', 'Trail Gear Discount', 'Discounts on outdoor and adventure gear', '🎒', 15.00, 'percentage_discount', 'accessories');

-- Insert personality evolutions
INSERT INTO public.personality_evolutions (base_personality, evolved_personality, evolution_name, trigger_type, trigger_threshold, duration_days, bonus_perks) VALUES
('Guard Dog', 'Zen Guard Dog', 'Zen Protector', 'spending_streak', '{"streak_days": 30, "category": "wellness"}', 30, '["Extra 10% off calming products", "Priority wellness checkups"]'),
('Chaotic Neutral', 'Retired Chaos Mode', 'Reformed Rebel', 'activity_pattern', '{"consecutive_calm_visits": 5}', 14, '["Double rewards on training services"]'),
('Couch Potato', 'Energized Potato', 'Active Mode', 'spending_streak', '{"activity_visits": 3, "period_days": 14}', 21, '["Walking service discounts", "Activity toy bonus"]'),
('Social Butterfly', 'Pack Leader', 'Social Star', 'badge_completion', '{"badges_in_month": 3}', 30, '["VIP daycare access", "Group booking discounts"]');

-- Insert default badge collections
INSERT INTO public.badge_collections (name, description, emoji, is_seasonal, completion_reward_type, completion_reward_value, completion_reward_description, is_active) VALUES
('Holiday Guilt Set', 'Celebrate the season of giving (to your pet)!', '🎄', true, 'credit', 25.00, '$25 Holiday Service Credit', true),
('Summer Spoiler', 'Keep your pet cool and happy all summer', '☀️', true, 'pawbucks', 5000, '5,000 Bonus PawBucks', true),
('First Timer Collection', 'Earn your first badges across different categories', '⭐', false, 'tier_progress', 1, 'Fast-track to Gold Tier', true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_tier_status_user ON public.user_tier_status(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_milestones_user ON public.loyalty_milestones(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_milestones_status ON public.loyalty_milestones(status);
CREATE INDEX IF NOT EXISTS idx_service_credits_user ON public.service_credits(user_id);
CREATE INDEX IF NOT EXISTS idx_service_credits_status ON public.service_credits(status);
CREATE INDEX IF NOT EXISTS idx_user_personality_perks_user ON public.user_personality_perks(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_warnings_user ON public.loyalty_warnings(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_warnings_dismissed ON public.loyalty_warnings(is_dismissed);

-- Create update triggers
CREATE TRIGGER update_user_tier_status_updated_at
  BEFORE UPDATE ON public.user_tier_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_milestones_updated_at
  BEFORE UPDATE ON public.loyalty_milestones
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_service_credits_updated_at
  BEFORE UPDATE ON public.service_credits
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();