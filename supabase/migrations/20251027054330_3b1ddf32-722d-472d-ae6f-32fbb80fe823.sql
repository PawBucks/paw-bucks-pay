-- Drop the security definer view
DROP VIEW IF EXISTS public.merchant_analytics;

-- Create a security invoker function instead
CREATE OR REPLACE FUNCTION public.get_merchant_analytics(_merchant_id UUID)
RETURNS TABLE (
  merchant_id UUID,
  business_name TEXT,
  total_transactions BIGINT,
  total_customers BIGINT,
  total_earnings NUMERIC,
  total_cashback_paid NUMERIC,
  avg_transaction_amount NUMERIC
)
LANGUAGE SQL
STABLE
SECURITY INVOKER
AS $$
  SELECT 
    m.id as merchant_id,
    m.business_name,
    COUNT(DISTINCT t.id) as total_transactions,
    COUNT(DISTINCT t.pet_owner_id) as total_customers,
    COALESCE(SUM(t.amount), 0) as total_earnings,
    COALESCE(SUM(t.cashback_amount), 0) as total_cashback_paid,
    COALESCE(AVG(t.amount), 0) as avg_transaction_amount
  FROM public.merchants m
  LEFT JOIN public.transactions t ON m.id = t.merchant_id
  WHERE m.id = _merchant_id AND m.user_id = auth.uid()
  GROUP BY m.id, m.business_name;
$$;