-- Grant permissions to supabase_auth_admin for the trigger
GRANT EXECUTE ON FUNCTION public.handle_new_user() TO supabase_auth_admin;
GRANT INSERT ON TABLE public.profiles TO supabase_auth_admin;