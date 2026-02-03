-- Fix RLS policies to be more restrictive (service role already bypasses RLS)
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Service role has full access to merchant subscriptions" ON public.merchant_subscriptions;
DROP POLICY IF EXISTS "Service role has full access to subscription events" ON public.merchant_subscription_events;

-- Users can insert their own subscriptions (via edge function will handle creation)
CREATE POLICY "Users can cancel their own subscriptions"
  ON public.merchant_subscriptions FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users should not be able to delete subscriptions directly
-- Cancellation sets status, doesn't delete