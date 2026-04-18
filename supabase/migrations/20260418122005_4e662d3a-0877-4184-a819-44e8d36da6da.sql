-- Add ban tracking to profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_banned boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS banned_at timestamptz,
  ADD COLUMN IF NOT EXISTS banned_by uuid,
  ADD COLUMN IF NOT EXISTS banned_reason text;

CREATE INDEX IF NOT EXISTS idx_profiles_is_banned ON public.profiles(is_banned) WHERE is_banned = true;

-- Helper to check if a user is banned (security definer to bypass RLS)
CREATE OR REPLACE FUNCTION public.is_user_banned(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((SELECT is_banned FROM public.profiles WHERE id = _user_id), false)
$$;

-- Helper used by the edge function (and admins) to fetch ban status alongside profile
CREATE OR REPLACE FUNCTION public.admin_set_user_ban(
  _target_user_id uuid,
  _banned boolean,
  _reason text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin uuid := auth.uid();
  v_is_admin boolean;
BEGIN
  IF v_admin IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = v_admin AND role IN ('admin', 'superadmin')
  ) INTO v_is_admin;

  IF NOT v_is_admin THEN
    RAISE EXCEPTION 'Unauthorized: admin access required';
  END IF;

  IF v_admin = _target_user_id THEN
    RAISE EXCEPTION 'Cannot ban your own account';
  END IF;

  -- Block banning other admins/superadmins
  IF EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _target_user_id AND role IN ('admin', 'superadmin')
  ) THEN
    RAISE EXCEPTION 'Cannot ban another admin or superadmin';
  END IF;

  UPDATE public.profiles
  SET
    is_banned = _banned,
    banned_at = CASE WHEN _banned THEN now() ELSE NULL END,
    banned_by = CASE WHEN _banned THEN v_admin ELSE NULL END,
    banned_reason = CASE WHEN _banned THEN _reason ELSE NULL END
  WHERE id = _target_user_id;

  -- Audit log
  INSERT INTO public.audit_logs (admin_id, action, entity_type, entity_id, changes)
  VALUES (
    v_admin,
    CASE WHEN _banned THEN 'BAN_USER' ELSE 'UNBAN_USER' END,
    'user',
    _target_user_id,
    jsonb_build_object('banned', _banned, 'reason', _reason)
  );

  RETURN jsonb_build_object('success', true, 'banned', _banned);
END;
$$;