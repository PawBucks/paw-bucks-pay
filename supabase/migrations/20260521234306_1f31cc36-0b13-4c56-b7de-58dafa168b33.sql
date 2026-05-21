
DROP POLICY IF EXISTS "Merchants can view transacting customer profiles" ON public.profiles;
DROP POLICY IF EXISTS "Merchants can view checkin user profiles" ON public.profiles;

CREATE OR REPLACE FUNCTION public.get_customer_profiles_for_merchant(p_user_ids uuid[])
RETURNS TABLE(id uuid, full_name text, email text, avatar_url text, phone text)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT p.id, p.full_name, p.email, p.avatar_url, p.phone
  FROM public.profiles p
  WHERE p.id = ANY(p_user_ids)
    AND (
      EXISTS (
        SELECT 1
        FROM public.transactions t
        JOIN public.merchants m ON m.id = t.merchant_id
        WHERE t.user_id = p.id
          AND t.status = 'completed'
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.checkins c
        JOIN public.merchants m ON m.id = c.merchant_id
        WHERE c.user_id = p.id
          AND m.user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1
        FROM public.checkins c
        JOIN public.partner_vets pv ON pv.id = c.vet_id
        WHERE c.user_id = p.id
          AND pv.user_id = auth.uid()
      )
    );
$function$;
