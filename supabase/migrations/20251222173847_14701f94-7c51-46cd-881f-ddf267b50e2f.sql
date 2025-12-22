-- Create a function to notify merchants when they receive a new review
CREATE OR REPLACE FUNCTION public.notify_merchant_on_review()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  merchant_user_id uuid;
  merchant_name text;
  reviewer_name text;
  should_notify boolean := true;
BEGIN
  -- Get the merchant's user_id and business name
  SELECT user_id, business_name INTO merchant_user_id, merchant_name
  FROM public.merchants
  WHERE id = NEW.merchant_id;
  
  -- Get the reviewer's name
  SELECT full_name INTO reviewer_name
  FROM public.profiles
  WHERE id = NEW.user_id;
  
  -- Check notification preferences (transactional category for reviews)
  SELECT COALESCE(transactional, true) INTO should_notify
  FROM public.notification_preferences
  WHERE user_id = merchant_user_id;
  
  -- If no preferences exist, default to sending notification
  IF NOT FOUND THEN
    should_notify := true;
  END IF;
  
  -- Create notification if merchant wants to receive them
  IF should_notify AND merchant_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, category)
    VALUES (
      merchant_user_id,
      'New Review Received',
      COALESCE(reviewer_name, 'A customer') || ' left a ' || NEW.rating || '-star review for ' || merchant_name || '.',
      'transactional'
    );
  END IF;
  
  RETURN NEW;
END;
$$;

-- Create trigger to fire after a new review is inserted
DROP TRIGGER IF EXISTS on_new_merchant_review ON public.merchant_reviews;
CREATE TRIGGER on_new_merchant_review
  AFTER INSERT ON public.merchant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_merchant_on_review();