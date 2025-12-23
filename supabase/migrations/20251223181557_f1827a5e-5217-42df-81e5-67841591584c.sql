-- Non-Partner PawBucks System Migration

-- Add new columns to pawbucks_activity for vesting and source tracking
ALTER TABLE public.pawbucks_activity 
ADD COLUMN IF NOT EXISTS pawbucks_status text DEFAULT 'available' CHECK (pawbucks_status IN ('pending', 'available')),
ADD COLUMN IF NOT EXISTS vest_date timestamp with time zone DEFAULT NULL,
ADD COLUMN IF NOT EXISTS receipt_id uuid DEFAULT NULL;

-- Add index for vesting scheduler
CREATE INDEX IF NOT EXISTS idx_pawbucks_activity_vesting 
ON public.pawbucks_activity (pawbucks_status, vest_date) 
WHERE pawbucks_status = 'pending';

-- Add index for monthly cap calculation
CREATE INDEX IF NOT EXISTS idx_pawbucks_activity_monthly_cap 
ON public.pawbucks_activity (user_id, source, created_at) 
WHERE source = 'non-partner';

-- Add decision_reason to receipt_submissions for rejection reasons
ALTER TABLE public.receipt_submissions 
ADD COLUMN IF NOT EXISTS decision_reason text DEFAULT NULL;

-- Create a function to get non-partner PawBucks for current month
CREATE OR REPLACE FUNCTION public.get_monthly_non_partner_pawbucks(p_user_id uuid)
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(SUM(amount), 0)::integer
  FROM pawbucks_activity
  WHERE user_id = p_user_id
    AND source = 'non-partner'
    AND type = 'credit'
    AND date_trunc('month', created_at AT TIME ZONE 'UTC') = date_trunc('month', now() AT TIME ZONE 'UTC')
$$;

-- Create a function to vest pending PawBucks (for scheduler)
CREATE OR REPLACE FUNCTION public.vest_pending_pawbucks()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  vested_count integer;
BEGIN
  -- Update all pending PawBucks where vest_date has passed
  UPDATE pawbucks_activity
  SET pawbucks_status = 'available'
  WHERE pawbucks_status = 'pending'
    AND vest_date IS NOT NULL
    AND vest_date <= now();
  
  GET DIAGNOSTICS vested_count = ROW_COUNT;
  
  RETURN vested_count;
END;
$$;

-- Create a function to get available vs pending PawBucks for a user
CREATE OR REPLACE FUNCTION public.get_pawbucks_breakdown(p_user_id uuid)
RETURNS TABLE(available_balance integer, pending_balance integer, total_balance integer)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH balances AS (
    SELECT 
      COALESCE(SUM(CASE WHEN pawbucks_status = 'available' OR pawbucks_status IS NULL THEN amount ELSE 0 END), 0)::integer as available,
      COALESCE(SUM(CASE WHEN pawbucks_status = 'pending' THEN amount ELSE 0 END), 0)::integer as pending
    FROM pawbucks_activity
    WHERE user_id = p_user_id
  )
  SELECT 
    available as available_balance,
    pending as pending_balance,
    (available + pending) as total_balance
  FROM balances;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.get_monthly_non_partner_pawbucks(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_monthly_non_partner_pawbucks(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.vest_pending_pawbucks() TO service_role;
GRANT EXECUTE ON FUNCTION public.get_pawbucks_breakdown(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_pawbucks_breakdown(uuid) TO service_role;