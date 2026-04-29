-- Vet onboarding email notifications: triggers + helper.
-- These triggers fire pg_net HTTP calls to the notify-vet-onboarding edge function.

-- 1. Track the last status we already emailed about so re-saves don't re-notify.
ALTER TABLE public.partner_vets
  ADD COLUMN IF NOT EXISTS last_notified_status text,
  ADD COLUMN IF NOT EXISTS submission_email_sent_at timestamptz;

-- 2. Private secrets table read only via SECURITY DEFINER trigger functions.
CREATE SCHEMA IF NOT EXISTS private;
REVOKE ALL ON SCHEMA private FROM PUBLIC, anon, authenticated;

CREATE TABLE IF NOT EXISTS private.system_config (
  key text PRIMARY KEY,
  value text NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

REVOKE ALL ON private.system_config FROM PUBLIC, anon, authenticated;

-- Seed expected keys (values to be set by the team out-of-band).
INSERT INTO private.system_config (key, value) VALUES
  ('internal_trigger_secret', 'PLACEHOLDER_REPLACE_ME'),
  ('edge_functions_base_url', 'https://yxpnkipcoxksmnsvpvwi.supabase.co/functions/v1')
ON CONFLICT (key) DO NOTHING;

-- 3. Generic dispatcher (SECURITY DEFINER so it can read private.system_config).
CREATE OR REPLACE FUNCTION private.invoke_edge_function(
  _function_name text,
  _payload jsonb
) RETURNS bigint
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = private, public, extensions
AS $$
DECLARE
  _base_url text;
  _secret text;
  _request_id bigint;
BEGIN
  SELECT value INTO _base_url FROM private.system_config WHERE key = 'edge_functions_base_url';
  SELECT value INTO _secret  FROM private.system_config WHERE key = 'internal_trigger_secret';

  IF _base_url IS NULL OR _secret IS NULL OR _secret = 'PLACEHOLDER_REPLACE_ME' THEN
    RAISE WARNING 'invoke_edge_function: system_config not initialized; skipping call to %', _function_name;
    RETURN NULL;
  END IF;

  SELECT net.http_post(
    url := _base_url || '/' || _function_name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _secret
    ),
    body := _payload,
    timeout_milliseconds := 5000
  ) INTO _request_id;

  RETURN _request_id;
END;
$$;

REVOKE ALL ON FUNCTION private.invoke_edge_function(text, jsonb) FROM PUBLIC, anon, authenticated;

-- 4. Trigger: notify on submission (INSERT into partner_vets).
CREATE OR REPLACE FUNCTION public.notify_vet_onboarding_submitted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  PERFORM private.invoke_edge_function(
    'notify-vet-onboarding',
    jsonb_build_object(
      'mode', 'submitted',
      'vet_id', NEW.id,
      'user_id', NEW.user_id,
      'clinic_name', NEW.clinic_name
    )
  );
  -- Mark when we sent so admin tooling can audit.
  NEW.submission_email_sent_at := now();
  NEW.last_notified_status := COALESCE(NEW.approval_status, 'pending');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_vets_notify_submitted ON public.partner_vets;
CREATE TRIGGER trg_partner_vets_notify_submitted
BEFORE INSERT ON public.partner_vets
FOR EACH ROW
EXECUTE FUNCTION public.notify_vet_onboarding_submitted();

-- 5. Trigger: notify on approval_status change (UPDATE).
CREATE OR REPLACE FUNCTION public.notify_vet_onboarding_status_changed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, private, extensions
AS $$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status IS DISTINCT FROM OLD.last_notified_status THEN
    PERFORM private.invoke_edge_function(
      'notify-vet-onboarding',
      jsonb_build_object(
        'mode', 'status_changed',
        'vet_id', NEW.id,
        'user_id', NEW.user_id,
        'clinic_name', NEW.clinic_name,
        'status', NEW.approval_status,
        'previous_status', OLD.approval_status
      )
    );
    NEW.last_notified_status := NEW.approval_status;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_partner_vets_notify_status_changed ON public.partner_vets;
CREATE TRIGGER trg_partner_vets_notify_status_changed
BEFORE UPDATE OF approval_status ON public.partner_vets
FOR EACH ROW
EXECUTE FUNCTION public.notify_vet_onboarding_status_changed();