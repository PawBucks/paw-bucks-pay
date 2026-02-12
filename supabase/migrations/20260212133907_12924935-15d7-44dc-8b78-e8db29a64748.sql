
-- Add streak_required_count to badge definitions (for badges like Snack Attack that require consecutive periods)
ALTER TABLE public.guilt_badge_definitions 
ADD COLUMN IF NOT EXISTS streak_required_count integer NOT NULL DEFAULT 1;

-- Add min_cash_per_transaction to tier definitions (e.g. $25 minimum cash per qualifying transaction)
ALTER TABLE public.consumer_tier_definitions 
ADD COLUMN IF NOT EXISTS min_cash_per_transaction numeric NOT NULL DEFAULT 0;

-- Add comment for clarity
COMMENT ON COLUMN public.guilt_badge_definitions.streak_required_count IS 'Number of consecutive periods required to earn this badge (e.g. 4 consecutive weeks for Snack Attack)';
COMMENT ON COLUMN public.consumer_tier_definitions.min_cash_per_transaction IS 'Minimum cash spend per transaction to count toward tier qualification';
