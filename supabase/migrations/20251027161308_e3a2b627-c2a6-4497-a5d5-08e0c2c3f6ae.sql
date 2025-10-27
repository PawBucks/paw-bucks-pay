-- Drop existing function and recreate with new fields
DROP FUNCTION IF EXISTS public.get_merchant_analytics(uuid);

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
  funding_deal_status text
)
LANGUAGE sql
STABLE
SET search_path TO 'public'
AS $$
  SELECT 
    m.id as merchant_id,
    m.business_name,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT t.user_id) as total_customers,
    COALESCE(SUM(t.amount), 0) as total_earnings,
    COALESCE(SUM(t.cashback_earned), 0) as total_cashback_paid,
    COALESCE(AVG(t.amount), 0) as avg_transaction_amount,
    COALESCE(fd.repayment_rate, 0) as repayment_rate,
    COALESCE(GREATEST(fd.amount_funded - fd.total_repaid, 0), 0) as remaining_balance,
    fd.status as funding_deal_status
  FROM public.merchants m
  LEFT JOIN public.transactions t ON m.id = t.merchant_id
  LEFT JOIN public.funding_deals fd ON m.id = fd.merchant_id AND fd.status = 'active'
  WHERE m.id = _merchant_id AND m.user_id = auth.uid()
  GROUP BY m.id, m.business_name, fd.repayment_rate, fd.amount_funded, fd.total_repaid, fd.status;
$$;