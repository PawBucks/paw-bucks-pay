-- Drop the invalid trigger on wallets table
-- The wallets table uses 'last_updated' not 'updated_at', and this is already updated in log_wallet_activity
DROP TRIGGER IF EXISTS update_wallets_updated_at ON public.wallets;