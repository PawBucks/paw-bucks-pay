CREATE OR REPLACE FUNCTION public.default_pawbucks_cap_pct(p_business_type text)
 RETURNS integer
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO 'public'
AS $function$
  SELECT CASE
    WHEN p_business_type IN ('veterinary') THEN 10
    WHEN p_business_type IN ('pet_store', 'food', 'delivery', 'insurance') THEN 20
    WHEN p_business_type IN ('grooming','mobile_groomer','boarding','training','walker','daycare','sitter','photography','hiker','runner','masseuse','behaviorist','breeder','rescue_nonprofit','pet_waste_removal') THEN 30
    ELSE 20
  END;
$function$;