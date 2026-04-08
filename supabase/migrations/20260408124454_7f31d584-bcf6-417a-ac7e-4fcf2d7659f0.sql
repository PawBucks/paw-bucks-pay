
-- Table for founding 50 badges
CREATE TABLE public.founding_50_badges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('merchant', 'vet')),
  entity_id UUID NOT NULL,
  user_id UUID NOT NULL,
  badge_number INTEGER NOT NULL CHECK (badge_number >= 1 AND badge_number <= 50),
  awarded_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id)
);

-- Index for quick lookups
CREATE INDEX idx_founding_50_entity ON founding_50_badges (entity_type, entity_id);

-- Enable RLS
ALTER TABLE public.founding_50_badges ENABLE ROW LEVEL SECURITY;

-- Anyone can view (public badge)
CREATE POLICY "Founding 50 badges are publicly viewable"
ON public.founding_50_badges FOR SELECT USING (true);

-- Only system (service role) can insert - no user inserts
CREATE POLICY "System can insert founding 50 badges"
ON public.founding_50_badges FOR INSERT
WITH CHECK (false);

-- Trigger function for merchants
CREATE OR REPLACE FUNCTION public.auto_award_founding_50_merchant()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_current_count FROM founding_50_badges;
  
  IF v_current_count < 50 THEN
    INSERT INTO founding_50_badges (entity_type, entity_id, user_id, badge_number)
    VALUES ('merchant', NEW.id, NEW.user_id, v_current_count + 1)
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Trigger function for vets
CREATE OR REPLACE FUNCTION public.auto_award_founding_50_vet()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_current_count FROM founding_50_badges;
  
  IF v_current_count < 50 THEN
    INSERT INTO founding_50_badges (entity_type, entity_id, user_id, badge_number)
    VALUES ('vet', NEW.id, NEW.user_id, v_current_count + 1)
    ON CONFLICT (entity_type, entity_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach triggers
CREATE TRIGGER trg_founding_50_merchant
AFTER INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.auto_award_founding_50_merchant();

CREATE TRIGGER trg_founding_50_vet
AFTER INSERT ON public.partner_vets
FOR EACH ROW
EXECUTE FUNCTION public.auto_award_founding_50_vet();

-- Seed existing merchants
INSERT INTO founding_50_badges (entity_type, entity_id, user_id, badge_number)
SELECT 'merchant', id, user_id, ROW_NUMBER() OVER (ORDER BY created_at ASC)
FROM merchants
ORDER BY created_at ASC
ON CONFLICT (entity_type, entity_id) DO NOTHING;

-- Seed existing vets
INSERT INTO founding_50_badges (entity_type, entity_id, user_id, badge_number)
SELECT 'vet', id, user_id, 
  (SELECT COUNT(*) FROM founding_50_badges) + ROW_NUMBER() OVER (ORDER BY created_at ASC)
FROM partner_vets
ORDER BY created_at ASC
ON CONFLICT (entity_type, entity_id) DO NOTHING;
