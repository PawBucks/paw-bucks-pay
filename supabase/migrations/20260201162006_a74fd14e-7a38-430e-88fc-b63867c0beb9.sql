
-- =========================================================
-- SECURITY FIX PART 2: Fix views with SECURITY INVOKER
-- =========================================================

-- 2a. FIX: merchant_customer_contacts view - Recreate with SECURITY INVOKER and merchant scoping
DROP VIEW IF EXISTS public.merchant_customer_contacts;

CREATE VIEW public.merchant_customer_contacts
WITH (security_invoker = on)
AS
SELECT DISTINCT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.stripe_customer_id,
    t.merchant_id
FROM profiles p
JOIN transactions t ON t.user_id = p.id
WHERE t.status = 'completed';

COMMENT ON VIEW public.merchant_customer_contacts IS 
'Merchant customer contacts - SECURITY INVOKER ensures RLS on profiles/transactions tables is respected.';
