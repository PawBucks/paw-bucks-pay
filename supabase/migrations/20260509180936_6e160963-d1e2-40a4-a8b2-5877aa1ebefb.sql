CREATE OR REPLACE FUNCTION public.notify_merchant_onboarding_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
  NEW.last_notified_status := COALESCE(NEW.approval_status::text, 'pending');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_merchant_onboarding_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'extensions'
AS $function$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status::text IS DISTINCT FROM OLD.last_notified_status THEN
    PERFORM private.invoke_edge_function(
      'notify-merchant-onboarding',
      jsonb_build_object(
        'mode', 'status_changed',
        'merchant_id', NEW.id,
        'user_id', NEW.user_id,
        'business_name', NEW.business_name,
        'status', NEW.approval_status::text,
        'previous_status', OLD.approval_status::text
      )
    );
    NEW.last_notified_status := NEW.approval_status::text;
  END IF;
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_vet_onboarding_submitted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'extensions'
AS $function$
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
  NEW.submission_email_sent_at := now();
  NEW.last_notified_status := COALESCE(NEW.approval_status::text, 'pending');
  RETURN NEW;
END;
$function$;

CREATE OR REPLACE FUNCTION public.notify_vet_onboarding_status_changed()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'private', 'extensions'
AS $function$
BEGIN
  IF NEW.approval_status IS DISTINCT FROM OLD.approval_status
     AND NEW.approval_status::text IS DISTINCT FROM OLD.last_notified_status THEN
    PERFORM private.invoke_edge_function(
      'notify-vet-onboarding',
      jsonb_build_object(
        'mode', 'status_changed',
        'vet_id', NEW.id,
        'user_id', NEW.user_id,
        'clinic_name', NEW.clinic_name,
        'status', NEW.approval_status::text,
        'previous_status', OLD.approval_status::text
      )
    );
    NEW.last_notified_status := NEW.approval_status::text;
  END IF;
  RETURN NEW;
END;
$function$;