-- Drop the overly permissive policies
DROP POLICY IF EXISTS "Anyone can view brand account by invitation token" ON public.brand_accounts;
DROP POLICY IF EXISTS "Users can claim their brand account" ON public.brand_accounts;

-- Secure function to look up a brand by invitation token (no auth required)
CREATE OR REPLACE FUNCTION public.get_brand_by_invitation_token(p_token text)
RETURNS TABLE(
  id uuid,
  brand_name text,
  invitation_email text,
  invitation_claimed_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_token IS NULL OR length(p_token) < 10 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT ba.id, ba.brand_name, ba.invitation_email, ba.invitation_claimed_at
  FROM brand_accounts ba
  WHERE ba.invitation_token = p_token;
END;
$$;

-- Secure function to claim a brand account (requires auth + correct token)
CREATE OR REPLACE FUNCTION public.claim_brand_account(p_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_brand record;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF p_token IS NULL OR length(p_token) < 10 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid token');
  END IF;

  SELECT * INTO v_brand
  FROM brand_accounts ba
  WHERE ba.invitation_token = p_token
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid invitation link');
  END IF;

  IF v_brand.invitation_claimed_at IS NOT NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'This invitation has already been claimed');
  END IF;

  UPDATE brand_accounts
  SET user_id = v_user_id,
      invitation_claimed_at = now()
  WHERE id = v_brand.id
    AND invitation_token = p_token
    AND invitation_claimed_at IS NULL;

  RETURN jsonb_build_object('success', true);
END;
$$;