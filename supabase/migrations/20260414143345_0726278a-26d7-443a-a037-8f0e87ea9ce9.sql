-- Shopping carts table
CREATE TABLE public.shopping_carts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  last_activity_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  abandoned_at TIMESTAMP WITH TIME ZONE,
  converted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_shopping_carts_active_user ON public.shopping_carts (user_id) WHERE status = 'active';

ALTER TABLE public.shopping_carts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own carts" ON public.shopping_carts FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create their own carts" ON public.shopping_carts FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own carts" ON public.shopping_carts FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own carts" ON public.shopping_carts FOR DELETE USING (auth.uid() = user_id);

-- Shopping cart items table
CREATE TABLE public.shopping_cart_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.shopping_carts(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.pet_store_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  added_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(cart_id, item_id)
);

ALTER TABLE public.shopping_cart_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own cart items" ON public.shopping_cart_items FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.shopping_carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "Users can add to their own cart" ON public.shopping_cart_items FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM public.shopping_carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "Users can update their own cart items" ON public.shopping_cart_items FOR UPDATE
  USING (EXISTS (SELECT 1 FROM public.shopping_carts WHERE id = cart_id AND user_id = auth.uid()));
CREATE POLICY "Users can remove from their own cart" ON public.shopping_cart_items FOR DELETE
  USING (EXISTS (SELECT 1 FROM public.shopping_carts WHERE id = cart_id AND user_id = auth.uid()));

-- Abandoned cart notifications log
CREATE TABLE public.abandoned_cart_notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  cart_id UUID NOT NULL REFERENCES public.shopping_carts(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'first_reminder',
  sent_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  items_snapshot JSONB,
  total_value_usd INTEGER DEFAULT 0,
  total_value_pawbucks INTEGER DEFAULT 0
);

ALTER TABLE public.abandoned_cart_notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own abandoned cart notifications" ON public.abandoned_cart_notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Trigger to update shopping_carts.updated_at
CREATE TRIGGER update_shopping_carts_updated_at
  BEFORE UPDATE ON public.shopping_carts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_shopping_cart_items_updated_at
  BEFORE UPDATE ON public.shopping_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Update last_activity_at on cart when items change
CREATE OR REPLACE FUNCTION public.update_cart_last_activity()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE shopping_carts 
  SET last_activity_at = now() 
  WHERE id = COALESCE(NEW.cart_id, OLD.cart_id);
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER cart_item_activity_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.shopping_cart_items
  FOR EACH ROW EXECUTE FUNCTION public.update_cart_last_activity();