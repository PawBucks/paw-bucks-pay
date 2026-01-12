-- Drop existing functions first to change return types
DROP FUNCTION IF EXISTS public.get_admin_analytics();
DROP FUNCTION IF EXISTS public.get_merchant_analytics(uuid);

-- Recreate get_admin_analytics to properly handle refunds and exclude refunded transactions from counts
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS TABLE(
  total_users bigint, 
  total_merchants bigint, 
  total_transactions bigint, 
  total_gmv numeric, 
  total_cashback_distributed numeric,
  total_refunded_transactions bigint,
  total_refunded_amount numeric
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT 
    (SELECT COUNT(*) FROM profiles WHERE user_type = 'pet_owner') as total_users,
    (SELECT COUNT(*) FROM merchants) as total_merchants,
    -- Only count completed transactions (excludes refunded)
    (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as total_transactions,
    -- GMV from completed transactions only
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'completed'), 0) as total_gmv,
    -- Rewards from completed transactions only
    COALESCE((SELECT SUM(rewards_earned) FROM transactions WHERE status = 'completed'), 0) as total_cashback_distributed,
    -- Track refunds separately for visibility
    (SELECT COUNT(*) FROM transactions WHERE status = 'refunded') as total_refunded_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'refunded'), 0) as total_refunded_amount;
$$;

-- Recreate get_merchant_analytics to properly filter by status and exclude refunded transactions
CREATE OR REPLACE FUNCTION public.get_merchant_analytics(_merchant_id uuid)
RETURNS TABLE(
  merchant_id uuid, 
  business_name text, 
  total_transactions bigint, 
  total_customers bigint, 
  total_earnings numeric, 
  total_cashback_paid numeric, 
  avg_transaction_amount numeric, 
  repayment_rate numeric, 
  remaining_balance numeric, 
  funding_deal_status text,
  refunded_transactions bigint,
  refunded_amount numeric
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    m.id as merchant_id,
    m.business_name,
    -- Only count completed transactions
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.id END) as total_transactions,
    COUNT(DISTINCT CASE WHEN t.status = 'completed' THEN t.user_id END) as total_customers,
    -- Only sum completed transaction amounts
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.amount ELSE 0 END), 0) as total_earnings,
    -- Only sum cashback from completed transactions
    COALESCE(SUM(CASE WHEN t.status = 'completed' THEN t.cashback_earned ELSE 0 END), 0) as total_cashback_paid,
    COALESCE(AVG(CASE WHEN t.status = 'completed' THEN t.amount END), 0) as avg_transaction_amount,
    COALESCE(fd.repayment_rate, 0) as repayment_rate,
    COALESCE(GREATEST(fd.amount_funded - fd.total_repaid, 0), 0) as remaining_balance,
    fd.status as funding_deal_status,
    -- Track refunds separately
    COUNT(DISTINCT CASE WHEN t.status = 'refunded' THEN t.id END) as refunded_transactions,
    COALESCE(SUM(CASE WHEN t.status = 'refunded' THEN t.amount ELSE 0 END), 0) as refunded_amount
  FROM public.merchants m
  LEFT JOIN public.transactions t ON m.id = t.merchant_id
  LEFT JOIN public.funding_deals fd ON m.id = fd.merchant_id AND fd.status = 'active'
  WHERE m.id = _merchant_id AND m.user_id = auth.uid()
  GROUP BY m.id, m.business_name, fd.repayment_rate, fd.amount_funded, fd.total_repaid, fd.status;
$$;