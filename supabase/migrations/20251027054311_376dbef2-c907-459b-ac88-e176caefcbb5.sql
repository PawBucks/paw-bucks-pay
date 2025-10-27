-- Add Stripe Connect fields to merchants table
ALTER TABLE public.merchants ADD COLUMN stripe_account_id TEXT;
ALTER TABLE public.merchants ADD COLUMN stripe_account_status TEXT DEFAULT 'pending';
ALTER TABLE public.merchants ADD COLUMN contact_person TEXT;

-- Create merchant analytics view for easier querying
CREATE OR REPLACE VIEW public.merchant_analytics AS
SELECT 
  m.id as merchant_id,
  m.business_name,
  m.user_id,
  COUNT(DISTINCT t.id) as total_transactions,
  COUNT(DISTINCT t.pet_owner_id) as total_customers,
  COALESCE(SUM(t.amount), 0) as total_earnings,
  COALESCE(SUM(t.cashback_amount), 0) as total_cashback_paid,
  COALESCE(AVG(t.amount), 0) as avg_transaction_amount
FROM public.merchants m
LEFT JOIN public.transactions t ON m.id = t.merchant_id
WHERE m.user_id = auth.uid()
GROUP BY m.id, m.business_name, m.user_id;