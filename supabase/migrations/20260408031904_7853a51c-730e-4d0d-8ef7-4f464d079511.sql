
CREATE OR REPLACE FUNCTION public.checkin_date(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
SET search_path TO 'public'
AS $$ SELECT ts::date $$;
