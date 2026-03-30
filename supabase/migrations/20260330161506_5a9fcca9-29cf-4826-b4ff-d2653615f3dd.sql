-- Drop the old 2-parameter overload that hardcodes Series A only
DROP FUNCTION IF EXISTS public.initialize_pet_fund(uuid, uuid);