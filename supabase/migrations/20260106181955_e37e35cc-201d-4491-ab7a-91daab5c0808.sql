-- Enable realtime for PawBucks wallet and activity tables
-- This allows Pet Owners to see their balance update immediately after transactions

-- Enable REPLICA IDENTITY for complete row data in realtime
ALTER TABLE public.pawbucks_wallet REPLICA IDENTITY FULL;
ALTER TABLE public.pawbucks_activity REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;

-- Add tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.pawbucks_wallet;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pawbucks_activity;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;