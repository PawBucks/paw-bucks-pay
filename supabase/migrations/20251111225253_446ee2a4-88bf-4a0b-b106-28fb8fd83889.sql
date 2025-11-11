-- Create pet store items table
CREATE TABLE public.pet_store_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  price INTEGER NOT NULL, -- Price in PawBucks
  image_url TEXT,
  stock_quantity INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pet store orders table
CREATE TABLE public.pet_store_orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_amount INTEGER NOT NULL, -- Total in PawBucks
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create pet store order items table
CREATE TABLE public.pet_store_order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.pet_store_orders(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.pet_store_items(id) ON DELETE RESTRICT,
  quantity INTEGER NOT NULL,
  price_per_item INTEGER NOT NULL, -- Price at time of purchase
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.pet_store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_store_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pet_store_order_items ENABLE ROW LEVEL SECURITY;

-- RLS Policies for pet_store_items
CREATE POLICY "Everyone can view active items"
  ON public.pet_store_items
  FOR SELECT
  USING (is_active = true);

CREATE POLICY "Admins can view all items"
  ON public.pet_store_items
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can insert items"
  ON public.pet_store_items
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update items"
  ON public.pet_store_items
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete items"
  ON public.pet_store_items
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for pet_store_orders
CREATE POLICY "Users can view their own orders"
  ON public.pet_store_orders
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own orders"
  ON public.pet_store_orders
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
  ON public.pet_store_orders
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for pet_store_order_items
CREATE POLICY "Users can view their order items"
  ON public.pet_store_order_items
  FOR SELECT
  USING (order_id IN (
    SELECT id FROM public.pet_store_orders WHERE user_id = auth.uid()
  ));

CREATE POLICY "Users can create order items"
  ON public.pet_store_order_items
  FOR INSERT
  WITH CHECK (order_id IN (
    SELECT id FROM public.pet_store_orders WHERE user_id = auth.uid()
  ));

CREATE POLICY "Admins can view all order items"
  ON public.pet_store_order_items
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

-- Create trigger for updated_at
CREATE TRIGGER update_pet_store_items_updated_at
  BEFORE UPDATE ON public.pet_store_items
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_pet_store_orders_updated_at
  BEFORE UPDATE ON public.pet_store_orders
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();