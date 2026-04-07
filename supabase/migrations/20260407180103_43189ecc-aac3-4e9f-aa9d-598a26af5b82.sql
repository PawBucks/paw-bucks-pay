
CREATE OR REPLACE FUNCTION public.get_checkin_user_emails(p_user_ids UUID[], p_entity_id UUID, p_entity_type TEXT)
RETURNS TABLE(user_id UUID, email TEXT)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Verify caller owns the entity
  IF p_entity_type = 'merchant' THEN
    IF NOT EXISTS (SELECT 1 FROM merchants WHERE id = p_entity_id AND user_id = auth.uid()) THEN
      RETURN;
    END IF;
    -- Only return emails for users who actually checked in at this merchant
    RETURN QUERY
      SELECT DISTINCT au.id, au.email::TEXT
      FROM auth.users au
      JOIN checkins c ON c.user_id = au.id AND c.merchant_id = p_entity_id
      WHERE au.id = ANY(p_user_ids);
  ELSIF p_entity_type = 'vet' THEN
    IF NOT EXISTS (SELECT 1 FROM partner_vets WHERE id = p_entity_id AND user_id = auth.uid()) THEN
      RETURN;
    END IF;
    RETURN QUERY
      SELECT DISTINCT au.id, au.email::TEXT
      FROM auth.users au
      JOIN checkins c ON c.user_id = au.id AND c.vet_id = p_entity_id
      WHERE au.id = ANY(p_user_ids);
  END IF;
END;
$$;
