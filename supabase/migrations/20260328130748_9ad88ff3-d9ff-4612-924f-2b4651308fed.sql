
-- Function to handle wallet adjustment when a transaction is refunded
CREATE OR REPLACE FUNCTION public.adjust_wallet_on_refund()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Only trigger when status changes TO 'refunded' from something else
  IF NEW.status = 'refunded' AND OLD.status != 'refunded' AND NEW.user_id IS NOT NULL THEN
    -- Decrement total_spent by the refunded amount
    UPDATE public.wallets
    SET 
      total_spent = GREATEST(total_spent - OLD.amount, 0),
      last_updated = now()
    WHERE user_id = NEW.user_id;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger for refund handling
CREATE TRIGGER on_transaction_refunded
  AFTER UPDATE ON public.transactions
  FOR EACH ROW
  WHEN (NEW.status = 'refunded' AND OLD.status != 'refunded')
  EXECUTE FUNCTION adjust_wallet_on_refund();
