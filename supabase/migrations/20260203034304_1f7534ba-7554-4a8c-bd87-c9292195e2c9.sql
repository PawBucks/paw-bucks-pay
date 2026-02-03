-- Remove duplicate FK constraint that's causing PostgREST ambiguity
-- Both transactions_pet_owner_id_fkey and transactions_user_id_fkey point from user_id to profiles
-- We keep transactions_user_id_fkey (the correct semantic name)

ALTER TABLE public.transactions
DROP CONSTRAINT IF EXISTS transactions_pet_owner_id_fkey;