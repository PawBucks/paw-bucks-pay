-- Pet Timeline Moments table
-- Stores AI-generated narrative moments for each pet based on transactions
CREATE TABLE public.pet_timeline_moments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pet_id UUID NOT NULL REFERENCES public.pet_profiles(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES public.transactions(id) ON DELETE SET NULL,
  
  -- Moment content
  title TEXT NOT NULL,
  narrative TEXT NOT NULL,
  emoji TEXT NOT NULL DEFAULT '🐾',
  photo_url TEXT,
  photo_prompt TEXT, -- What was used to generate/select the photo
  
  -- Transaction context
  merchant_name TEXT,
  merchant_category TEXT,
  amount NUMERIC(10,2),
  pawbucks_earned INTEGER DEFAULT 0,
  
  -- Moment metadata
  moment_type TEXT NOT NULL DEFAULT 'transaction', -- transaction, milestone, memory
  mood TEXT DEFAULT 'happy', -- happy, proud, cozy, adventurous, brave, playful
  
  -- Timestamps
  moment_date TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_timeline_moments ENABLE ROW LEVEL SECURITY;

-- Pet owners can view their own pets' moments
CREATE POLICY "Users can view their pets timeline moments"
  ON public.pet_timeline_moments
  FOR SELECT
  USING (auth.uid() = user_id);

-- Shared account members can view owner's pets' moments  
CREATE POLICY "Shared members can view owner pets timeline moments"
  ON public.pet_timeline_moments
  FOR SELECT
  USING (public.is_shared_member_of(user_id));

-- System/edge functions can insert moments (service role)
CREATE POLICY "Service role can manage timeline moments"
  ON public.pet_timeline_moments
  FOR ALL
  USING (true)
  WITH CHECK (true);

-- Users can delete their own moments
CREATE POLICY "Users can delete their own moments"
  ON public.pet_timeline_moments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Index for fast timeline queries
CREATE INDEX idx_pet_timeline_moments_pet_id ON public.pet_timeline_moments(pet_id);
CREATE INDEX idx_pet_timeline_moments_user_id ON public.pet_timeline_moments(user_id);
CREATE INDEX idx_pet_timeline_moments_date ON public.pet_timeline_moments(moment_date DESC);
CREATE INDEX idx_pet_timeline_moments_transaction ON public.pet_timeline_moments(transaction_id);

-- Trigger to update updated_at
CREATE TRIGGER update_pet_timeline_moments_updated_at
  BEFORE UPDATE ON public.pet_timeline_moments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for live updates
ALTER PUBLICATION supabase_realtime ADD TABLE public.pet_timeline_moments;