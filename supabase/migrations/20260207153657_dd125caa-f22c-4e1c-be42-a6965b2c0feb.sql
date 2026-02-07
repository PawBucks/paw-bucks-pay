-- Add personality columns to pet_profiles
ALTER TABLE public.pet_profiles
ADD COLUMN IF NOT EXISTS personality_type text,
ADD COLUMN IF NOT EXISTS personality_quiz_completed boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS personality_quiz_answers jsonb,
ADD COLUMN IF NOT EXISTS personality_completed_at timestamp with time zone;

-- Create pet personality types reference table
CREATE TABLE IF NOT EXISTS public.pet_personality_types (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  type_key text NOT NULL UNIQUE,
  name text NOT NULL,
  emoji text NOT NULL,
  tagline text NOT NULL,
  description text NOT NULL,
  avatar_style text NOT NULL,
  color_primary text NOT NULL,
  color_secondary text NOT NULL,
  traits text[] NOT NULL DEFAULT '{}',
  tips text[] NOT NULL DEFAULT '{}',
  badge_text text NOT NULL,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_personality_types ENABLE ROW LEVEL SECURITY;

-- Anyone can read personality types (public reference data)
CREATE POLICY "Anyone can read personality types"
  ON public.pet_personality_types
  FOR SELECT
  USING (true);

-- Insert the personality types
INSERT INTO public.pet_personality_types (type_key, name, emoji, tagline, description, avatar_style, color_primary, color_secondary, traits, tips, badge_text)
VALUES
  ('couch_potato', 'The Couch Potato', '🛋️', 'Living the dream, one nap at a time', 'Your pet has mastered the art of relaxation. They know the best spots in the house for naps and believe that the couch was invented specifically for them. Adventure? Maybe tomorrow.', 'relaxed', '#8B5CF6', '#A78BFA', ARRAY['Relaxed', 'Chill', 'Low-maintenance', 'Cuddly'], ARRAY['Cozy beds and blankets are your pet''s love language', 'Puzzle feeders can provide gentle mental stimulation', 'Short, leisurely walks are perfect for Couch Potatoes'], 'Official Couch Potato Parent 🛋️'),
  
  ('guard_dog', 'The Guard Dog', '🛡️', 'Protector of the realm (and the treats)', 'Your pet takes security VERY seriously. Every knock at the door is a potential threat, every squirrel a suspicious character. They''ve appointed themselves head of household security.', 'alert', '#EF4444', '#F87171', ARRAY['Protective', 'Alert', 'Brave', 'Loyal'], ARRAY['Mental stimulation toys keep Guard Dogs sharp', 'Training sessions help channel protective instincts', 'Secure spaces help them feel in control of their territory'], 'Official Guard Dog Parent 🛡️'),
  
  ('chaotic_neutral', 'The Chaotic Neutral', '😼', 'Rules? Never heard of them', 'Your pet operates on their own schedule, follows their own rules, and answers to no one. You don''t own them—they have simply allowed you to live in their house.', 'mischievous', '#F59E0B', '#FBBF24', ARRAY['Independent', 'Mysterious', 'Unpredictable', 'Sass master'], ARRAY['Puzzle toys satisfy their clever minds', 'They appreciate their alone time—respect the boundaries', 'Food is always a good negotiation tool'], 'Official Chaos Agent Parent 😼'),
  
  ('social_butterfly', 'The Social Butterfly', '🦋', 'Never met a stranger, only friends they haven''t made yet', 'Your pet believes everyone they meet is their new best friend. Dog park? Heaven. Vet visit? New friends! They''ve never met a human or animal they didn''t want to befriend.', 'friendly', '#10B981', '#34D399', ARRAY['Friendly', 'Outgoing', 'Energetic', 'People-pleaser'], ARRAY['Dog parks and play dates are essential for Social Butterflies', 'They thrive on positive social interactions', 'Group training classes are perfect for their personality'], 'Official Social Butterfly Parent 🦋'),
  
  ('adventurer', 'The Adventurer', '🏔️', 'The great outdoors is calling', 'Your pet was born to explore. Every walk is an expedition, every hike an adventure. They believe life is too short to stay inside, and they''re determined to sniff every single thing.', 'adventurous', '#3B82F6', '#60A5FA', ARRAY['Energetic', 'Curious', 'Brave', 'Explorer'], ARRAY['Hiking and outdoor adventures are perfect for Adventurers', 'They need plenty of physical exercise and new experiences', 'Interactive toys keep them engaged between adventures'], 'Official Adventure Buddy Parent 🏔️')
ON CONFLICT (type_key) DO NOTHING;

-- Create user personality badges table
CREATE TABLE IF NOT EXISTS public.user_personality_badges (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  pet_id uuid NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  personality_type text NOT NULL,
  badge_earned_at timestamp with time zone NOT NULL DEFAULT now(),
  is_displayed boolean DEFAULT true,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(pet_id)
);

-- Enable RLS for user badges
ALTER TABLE public.user_personality_badges ENABLE ROW LEVEL SECURITY;

-- Users can read their own badges
CREATE POLICY "Users can read their own personality badges"
  ON public.user_personality_badges
  FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own badges  
CREATE POLICY "Users can create their own personality badges"
  ON public.user_personality_badges
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own badges
CREATE POLICY "Users can update their own personality badges"
  ON public.user_personality_badges
  FOR UPDATE
  USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_pet_profiles_personality ON public.pet_profiles(personality_type);
CREATE INDEX IF NOT EXISTS idx_user_personality_badges_user ON public.user_personality_badges(user_id);
CREATE INDEX IF NOT EXISTS idx_user_personality_badges_pet ON public.user_personality_badges(pet_id);