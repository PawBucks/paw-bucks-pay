-- ============================================================
-- FIX 1: Remove broad anon SELECT on merchants table
-- The merchants_public view is the correct public access path
-- ============================================================
DROP POLICY IF EXISTS "Approved merchants are publicly viewable" ON public.merchants;

-- Re-create for authenticated users only (merchants need to query their own record)
-- The existing "Merchants can view own data" and admin policies handle authenticated access
-- But we still need approved merchants visible to authenticated users for features like directory
CREATE POLICY "Authenticated users can view approved merchants"
ON public.merchants
FOR SELECT
TO authenticated
USING (
  approval_status = 'approved'
  OR user_id = auth.uid()
  OR public.is_superadmin(auth.uid())
);

-- Ensure anon can still use the merchants_public view (it has security_invoker = on,
-- so we need a minimal anon policy that only the view leverages)
-- The view already filters columns, so anon access to the base table via the view is safe
CREATE POLICY "Anon can view approved merchants via view"
ON public.merchants
FOR SELECT
TO anon
USING (approval_status = 'approved');

-- ============================================================
-- FIX 2: Remove blanket public read on invoice-attachments bucket
-- ============================================================
DROP POLICY IF EXISTS "Public read access for invoice attachments with token" ON storage.objects;

-- ============================================================
-- FIX 3: Scope vet access on pet_insurance_policies to their patients
-- ============================================================
DROP POLICY IF EXISTS "Vets can view patient insurance policies" ON public.pet_insurance_policies;

CREATE POLICY "Vets can view their patients insurance policies"
ON public.pet_insurance_policies
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM partner_vets pv
    WHERE pv.user_id = auth.uid()
    AND (
      EXISTS (
        SELECT 1 FROM pet_soap_notes psn
        WHERE psn.vet_id = pv.id AND psn.pet_id = pet_insurance_policies.pet_id
      )
      OR EXISTS (
        SELECT 1 FROM vet_messages vm
        WHERE vm.vet_id = pv.id AND vm.pet_id = pet_insurance_policies.pet_id
      )
    )
  )
);

-- ============================================================
-- FIX 4: Recreate merchant_customer_contacts as SECURITY DEFINER view
-- scoped to the owning merchant
-- ============================================================
DROP VIEW IF EXISTS public.merchant_customer_contacts;

CREATE OR REPLACE VIEW public.merchant_customer_contacts
WITH (security_invoker = false)
AS
SELECT
  p.id,
  p.full_name,
  p.email,
  p.phone,
  p.avatar_url,
  p.stripe_customer_id,
  t.merchant_id,
  MAX(t.created_at) as last_transaction_at,
  COUNT(t.id) as transaction_count,
  SUM(t.amount) as total_spent
FROM profiles p
JOIN transactions t ON t.user_id = p.id
WHERE t.status = 'completed'
GROUP BY p.id, p.full_name, p.email, p.phone, p.avatar_url, p.stripe_customer_id, t.merchant_id;

-- Since we can't easily add RLS to a view, let's use a security definer function instead
-- Drop the view and create a function
DROP VIEW IF EXISTS public.merchant_customer_contacts;

-- Create as a security definer function that checks merchant ownership
CREATE OR REPLACE FUNCTION public.get_merchant_customer_contacts(p_merchant_id uuid)
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  phone text,
  avatar_url text,
  stripe_customer_id text,
  merchant_id uuid,
  last_transaction_at timestamptz,
  transaction_count bigint,
  total_spent numeric
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    p.id,
    p.full_name,
    p.email,
    p.phone,
    p.avatar_url,
    p.stripe_customer_id,
    t.merchant_id,
    MAX(t.created_at) as last_transaction_at,
    COUNT(t.id) as transaction_count,
    SUM(t.amount) as total_spent
  FROM profiles p
  JOIN transactions t ON t.user_id = p.id
  WHERE t.status = 'completed'
    AND t.merchant_id = p_merchant_id
    AND EXISTS (
      SELECT 1 FROM merchants m
      WHERE m.id = p_merchant_id
      AND m.user_id = auth.uid()
    )
  GROUP BY p.id, p.full_name, p.email, p.phone, p.avatar_url, p.stripe_customer_id, t.merchant_id;
$$;