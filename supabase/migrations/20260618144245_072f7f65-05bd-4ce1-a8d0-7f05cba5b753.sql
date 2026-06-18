
CREATE OR REPLACE FUNCTION public.prevent_profile_sensitive_field_updates()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  -- Service role / no JWT bypass (admin operations from edge functions)
  IF auth.uid() IS NULL THEN
    RETURN NEW;
  END IF;

  is_admin := has_role(auth.uid(), 'admin'::app_role) OR has_role(auth.uid(), 'superadmin'::app_role);
  IF is_admin THEN
    RETURN NEW;
  END IF;

  -- Non-admins cannot modify sensitive fields on their own profile
  IF NEW.is_banned IS DISTINCT FROM OLD.is_banned
     OR NEW.banned_at IS DISTINCT FROM OLD.banned_at
     OR NEW.banned_by IS DISTINCT FROM OLD.banned_by
     OR NEW.banned_reason IS DISTINCT FROM OLD.banned_reason
     OR NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id
     OR NEW.user_type IS DISTINCT FROM OLD.user_type
     OR NEW.email IS DISTINCT FROM OLD.email
     OR NEW.normalized_email IS DISTINCT FROM OLD.normalized_email
     OR NEW.id IS DISTINCT FROM OLD.id
     OR NEW.phone_verified IS DISTINCT FROM OLD.phone_verified
  THEN
    RAISE EXCEPTION 'Not authorized to modify protected profile fields';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS profiles_protect_sensitive_fields ON public.profiles;
CREATE TRIGGER profiles_protect_sensitive_fields
BEFORE UPDATE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.prevent_profile_sensitive_field_updates();
