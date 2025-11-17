-- Fix security warnings by setting search_path on existing functions that don't have it

-- Update update_pawbucks_wallet_timestamp function
CREATE OR REPLACE FUNCTION public.update_pawbucks_wallet_timestamp()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  NEW.last_updated = now();
  RETURN NEW;
END;
$function$;

-- Update create_pawbucks_wallet_for_user function (already has SECURITY DEFINER and search_path, but let's ensure it's correct)
CREATE OR REPLACE FUNCTION public.create_pawbucks_wallet_for_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $function$
BEGIN
  IF NEW.user_type = 'pet_owner' THEN
    INSERT INTO public.pawbucks_wallet (user_id)
    VALUES (NEW.id)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  RETURN NEW;
END;
$function$;