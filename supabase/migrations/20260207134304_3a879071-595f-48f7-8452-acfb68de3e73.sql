-- Fix the overly permissive policy by removing it and adding proper insert policy
DROP POLICY IF EXISTS "Service role can manage timeline moments" ON public.pet_timeline_moments;

-- Allow authenticated users to insert moments for their own pets
CREATE POLICY "Users can insert moments for their own pets"
  ON public.pet_timeline_moments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own moments  
CREATE POLICY "Users can update their own moments"
  ON public.pet_timeline_moments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);