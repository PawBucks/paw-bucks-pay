-- Add merchant PawBucks tables to realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_pawbucks_wallet;
ALTER PUBLICATION supabase_realtime ADD TABLE public.merchant_pawbucks_activity;