-- Fix overly permissive RLS policies for user_badge_promotions
-- Drop the permissive policies
DROP POLICY IF EXISTS "System can insert user badge promotions" ON public.user_badge_promotions;
DROP POLICY IF EXISTS "System can update user badge promotions" ON public.user_badge_promotions;

-- Create proper policies that use service role (handled via edge functions)
-- For inserts: Only service role or admin can insert (edge functions use service role)
CREATE POLICY "Service role can insert user badge promotions"
ON public.user_badge_promotions FOR INSERT
WITH CHECK (
  public.has_role(auth.uid(), 'admin') OR 
  public.has_role(auth.uid(), 'superadmin')
);

-- For updates: Users can only update their own to mark as used
CREATE POLICY "Users can update their own badge promotions"
ON public.user_badge_promotions FOR UPDATE
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);