
-- Restrict merchant access to customer profile sensitive columns
-- by replacing the broad SELECT policy with a security-definer RPC
-- returning only safe fields needed for sales reports.

DROP POLICY IF EXISTS "Merchants can view customer profiles for their transactions" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_customer_profiles_for_merchant(p_user_ids uuid[])
RETURNS TABLE (
  id uuid,
  full_name text,
  email text,
  avatar_url text,
  phone text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.phone
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids)
    AND EXISTS (
      SELECT 1
      FROM public.transactions t
      JOIN public.merchants m ON m.id = t.merchant_id
      WHERE t.user_id = p.id
        AND t.status = 'completed'
        AND m.user_id = auth.uid()
    );
$$;

REVOKE ALL ON FUNCTION public.get_customer_profiles_for_merchant(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_customer_profiles_for_merchant(uuid[]) TO authenticated;
