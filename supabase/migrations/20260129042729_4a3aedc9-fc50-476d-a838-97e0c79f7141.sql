-- Add slice_id column to pawbucks_activity for tracking locked rewards
ALTER TABLE public.pawbucks_activity
ADD COLUMN IF NOT EXISTS slice_id UUID REFERENCES public.invoice_slices(id) ON DELETE SET NULL;

-- Add index for efficient lookups of locked rewards by slice
CREATE INDEX IF NOT EXISTS idx_pawbucks_activity_slice_id ON public.pawbucks_activity(slice_id) WHERE slice_id IS NOT NULL;

-- Create a function to get user's spendable balance (excludes pending/locked rewards)
CREATE OR REPLACE FUNCTION public.get_spendable_pawbucks(p_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(balance, 0)::integer
  FROM pawbucks_wallet
  WHERE user_id = p_user_id
$$;

-- Create a function to get user's locked/pending rewards breakdown
CREATE OR REPLACE FUNCTION public.get_locked_pawbucks(p_user_id UUID)
RETURNS TABLE(
  total_locked INTEGER,
  items JSON
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH locked_items AS (
    SELECT 
      pa.id,
      pa.amount,
      pa.description,
      pa.created_at,
      pa.slice_id,
      COALESCE(isl.recovery_status, 'pending') as slice_status
    FROM pawbucks_activity pa
    LEFT JOIN invoice_slices isl ON pa.slice_id = isl.id
    WHERE pa.user_id = p_user_id
      AND pa.pawbucks_status = 'pending'
      AND pa.type = 'credit'
    ORDER BY pa.created_at DESC
  )
  SELECT 
    COALESCE(SUM(amount), 0)::integer as total_locked,
    COALESCE(json_agg(json_build_object(
      'id', id,
      'amount', amount,
      'description', description,
      'created_at', created_at,
      'slice_id', slice_id,
      'slice_status', slice_status
    )), '[]'::json) as items
  FROM locked_items;
$$;