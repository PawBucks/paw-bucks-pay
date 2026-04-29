-- Merchant onboarding email notifications: triggers reuse the existing
-- private.invoke_edge_function dispatcher and shared secret.

ALTER TABLE public.merchants
  ADD COLUMN IF NOT EXISTS last_notified_status text,
  ADD COLUMN IF NOT EXISTS submission_email_sent_at timestamptz;

-- Trigger: notify on submission (INSERT into merchants).
CREATE OR REPLACE FUNCTION public.notify_merchant_onboarding_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  PERFORM private.invoke_edge_function(
    'notify-merchant-onboarding',
    jsonb_build_object(
      'mode', 'submitted',
      'merchant_id', NEW.id,
      'user_id', NEW.user_id,
      'business_name', NEW.business_name
    )
  );
  NEW.submission_email_sent_at := now();
  NEW.last_notified_status := COALESCE(NEW.approval_status, 'pending');
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_merchant_onboarding_submitted() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_merchants_notify_submitted ON public.merchants;
CREATE TRIGGER trg_merchants_notify_submitted
BEFORE INSERT ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_onboarding_submitted();

-- Trigger: notify on approval_status change (UPDATE).
CREATE OR REPLACE FUNCTION public.notify_merchant_onboarding_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status IS DISTINCT FROM OLD.last_notified_status THEN
    PERFORM private.invoke_edge_function(
      'notify-merchant-onboarding',
      jsonb_build_object(
        'mode', 'status_changed',
        'merchant_id', NEW.id,
        'user_id', NEW.user_id,
        'business_name', NEW.business_name,
        'status', NEW.approval_status,
        'previous_status', OLD.approval_status
      )
    );
    NEW.last_notified_status := NEW.approval_status;
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.notify_merchant_onboarding_status_changed() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trg_merchants_notify_status_changed ON public.merchants;
CREATE TRIGGER trg_merchants_notify_status_changed
BEFORE UPDATE OF approval_status ON public.merchants
FOR EACH ROW
EXECUTE FUNCTION public.notify_merchant_onboarding_status_changed();