
-- Single RPC function to check user role and pet ownership in one round-trip
-- Replaces 4-8 separate queries in ProtectedRoute
CREATE OR REPLACE FUNCTION public.get_user_access_info(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'user_type', (SELECT user_type FROM profiles WHERE id = p_user_id),
    'system_roles', COALESCE(
      (SELECT jsonb_agg(role) FROM user_roles WHERE user_id = p_user_id),
      '[]'::jsonb
    ),
    'is_merchant', EXISTS(SELECT 1 FROM merchants WHERE user_id = p_user_id),
    'is_vet', EXISTS(SELECT 1 FROM partner_vets WHERE user_id = p_user_id),
    'has_pets', EXISTS(SELECT 1 FROM pet_profiles WHERE user_id = p_user_id),
    'has_shared_pets', EXISTS(
      SELECT 1 FROM shared_account_members sam
      JOIN pet_profiles pp ON pp.user_id = sam.owner_id
      WHERE sam.member_id = p_user_id AND sam.status = 'accepted'
    )
  );
$$;
