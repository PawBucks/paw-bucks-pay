-- Drop existing functions to allow return type changes
DROP FUNCTION IF EXISTS public.get_admin_analytics();
DROP FUNCTION IF EXISTS public.get_merchant_analytics(UUID);

-- Recreate get_admin_analytics with correct fee calculation
CREATE OR REPLACE FUNCTION public.get_admin_analytics()
RETURNS TABLE(
  total_users bigint,
  total_merchants bigint,
  total_transactions bigint,
  total_gmv numeric,
  total_rewards numeric,
  platform_revenue numeric,
  total_refunded_transactions bigint,
  total_refunded_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*) FROM profiles) as total_users,
    (SELECT COUNT(*) FROM merchants) as total_merchants,
    -- Only count completed transactions (excludes refunded)
    (SELECT COUNT(*) FROM transactions WHERE status = 'completed') as total_transactions,
    -- GMV = total amount from completed transactions only
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'completed'), 0) as total_gmv,
    -- Total rewards (PawBucks) distributed to users from completed transactions
    COALESCE((SELECT SUM(COALESCE(cashback_earned, 0) + COALESCE(rewards_earned, 0)) FROM transactions WHERE status = 'completed'), 0) as total_rewards,
    -- Platform revenue = 3% fee ONLY on Stripe portion (application_fee column), not on PawBucks
    COALESCE((SELECT SUM(COALESCE(application_fee, 0)) FROM transactions WHERE status = 'completed'), 0) as platform_revenue,
    -- Track refunds separately for visibility
    (SELECT COUNT(*) FROM transactions WHERE status = 'refunded') as total_refunded_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE status = 'refunded'), 0) as total_refunded_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recreate get_merchant_analytics with fee column
CREATE OR REPLACE FUNCTION public.get_merchant_analytics(p_merchant_id UUID)
RETURNS TABLE(
  total_sales numeric,
  transaction_count bigint,
  total_customers bigint,
  total_earnings numeric,
  total_cashback numeric,
  avg_transaction_amount numeric,
  total_fees numeric,
  refunded_transactions bigint,
  refunded_amount numeric
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    -- Total sales = sum of all completed transaction amounts
    COALESCE((SELECT SUM(amount) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed'), 0) as total_sales,
    -- Transaction count = completed transactions only
    (SELECT COUNT(*) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed') as transaction_count,
    -- Unique customers = distinct user_ids from completed transactions
    (SELECT COUNT(DISTINCT user_id) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed') as total_customers,
    -- Merchant earnings = total sales minus platform fees (fees only on Stripe portion)
    COALESCE((SELECT SUM(amount) - SUM(COALESCE(application_fee, 0)) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed'), 0) as total_earnings,
    -- Total cashback/rewards given to customers (in PawBucks)
    COALESCE((SELECT SUM(COALESCE(cashback_earned, 0)) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed'), 0) as total_cashback,
    -- Average transaction amount
    COALESCE((SELECT AVG(amount) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed'), 0) as avg_transaction_amount,
    -- Total platform fees (only on Stripe portion)
    COALESCE((SELECT SUM(COALESCE(application_fee, 0)) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'completed'), 0) as total_fees,
    -- Refund tracking
    (SELECT COUNT(*) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'refunded') as refunded_transactions,
    COALESCE((SELECT SUM(amount) FROM transactions WHERE merchant_id = p_merchant_id AND status = 'refunded'), 0) as refunded_amount;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;