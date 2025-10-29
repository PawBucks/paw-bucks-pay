-- Remove insecure role column from profiles table to prevent privilege escalation
-- Roles are properly managed in the user_roles table with the app_role enum
ALTER TABLE public.profiles DROP COLUMN IF EXISTS role;