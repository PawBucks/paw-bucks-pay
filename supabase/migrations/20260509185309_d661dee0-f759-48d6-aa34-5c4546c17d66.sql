-- Allow vets to update their own partner_vets profile fields, but
-- prevent them from changing approval/verification fields via a trigger.

CREATE POLICY "Vets can update their own record"
ON public.partner_vets
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.prevent_vet_self_approval_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Skip enforcement for admins/superadmins
  IF public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin') THEN
    RETURN NEW;
  END IF;

  -- Block changes to approval/trust-related columns by the vet themselves
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     OR NEW.approved_at IS DISTINCT FROM OLD.approved_at
     OR NEW.approved_by IS DISTINCT FROM OLD.approved_by
     OR NEW.denial_reason IS DISTINCT FROM OLD.denial_reason
     OR NEW.is_verified IS DISTINCT FROM OLD.is_verified
     OR NEW.user_id IS DISTINCT FROM OLD.user_id
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id
     OR NEW.stripe_connect_account_id IS DISTINCT FROM OLD.stripe_connect_account_id
  THEN
    RAISE EXCEPTION 'You cannot modify approval or billing fields on your own record';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prevent_vet_self_approval_changes_trg ON public.partner_vets;
CREATE TRIGGER prevent_vet_self_approval_changes_trg
BEFORE UPDATE ON public.partner_vets
FOR EACH ROW
EXECUTE FUNCTION public.prevent_vet_self_approval_changes();
