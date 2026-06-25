
DROP POLICY IF EXISTS "Owners can update their shared members" ON public.shared_account_members;

CREATE POLICY "Owners can update their shared members"
ON public.shared_account_members
FOR UPDATE
USING (auth.uid() = owner_id)
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Members can respond to their invitation"
ON public.shared_account_members
FOR UPDATE
USING (auth.uid() = member_id)
WITH CHECK (
  auth.uid() = member_id
  AND status IN ('accepted','declined')
);

CREATE OR REPLACE FUNCTION public.prevent_shared_member_identity_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.owner_id IS DISTINCT FROM OLD.owner_id THEN
    RAISE EXCEPTION 'owner_id cannot be changed';
  END IF;
  IF NEW.member_email IS DISTINCT FROM OLD.member_email THEN
    RAISE EXCEPTION 'member_email cannot be changed';
  END IF;
  IF NEW.member_id IS DISTINCT FROM OLD.member_id THEN
    IF OLD.member_id IS NOT NULL AND NEW.member_id IS DISTINCT FROM OLD.member_id THEN
      RAISE EXCEPTION 'member_id cannot be changed once set';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_shared_member_identity_change ON public.shared_account_members;
CREATE TRIGGER trg_prevent_shared_member_identity_change
BEFORE UPDATE ON public.shared_account_members
FOR EACH ROW
EXECUTE FUNCTION public.prevent_shared_member_identity_change();
