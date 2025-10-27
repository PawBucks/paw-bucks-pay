-- Create webhook_logs table to track all incoming Stripe events
CREATE TABLE public.webhook_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  processed BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on webhook_logs
ALTER TABLE public.webhook_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view webhook logs
CREATE POLICY "Admins can view webhook logs"
ON public.webhook_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Service role can insert webhook logs
CREATE POLICY "Service role can insert webhook logs"
ON public.webhook_logs
FOR INSERT
WITH CHECK ((auth.jwt() ->> 'role') = 'service_role');

-- Add index for faster duplicate checking
CREATE INDEX idx_webhook_logs_event_id ON public.webhook_logs(event_id);

-- Create analytics view for admin dashboard
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS TABLE(
  total_users BIGINT,
  total_merchants BIGINT,
  total_transactions BIGINT,
  total_gmv NUMERIC,
  total_cashback_distributed NUMERIC
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE user_type = 'pet_owner') as total_users,
    (SELECT COUNT(*) FROM merchants) as total_merchants,
    (SELECT COUNT(*) FROM transactions) as total_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'completed'), 0) as total_gmv,
    COALESCE((SELECT SUM(cashback_earned) FROM transactions WHERE status = 'completed'), 0) as total_cashback_distributed;
$$;