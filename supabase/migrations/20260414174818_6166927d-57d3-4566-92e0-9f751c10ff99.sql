
-- Product reviews table
CREATE TABLE public.pet_store_reviews (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID NOT NULL REFERENCES public.pet_store_items(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  title TEXT,
  body TEXT,
  is_verified_purchase BOOLEAN NOT NULL DEFAULT false,
  helpful_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(item_id, user_id)
);

-- Materialized rating summary on items for fast queries
ALTER TABLE public.pet_store_items
  ADD COLUMN IF NOT EXISTS rating_avg NUMERIC(3,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS rating_count INTEGER DEFAULT 0;

-- RLS
ALTER TABLE public.pet_store_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read reviews
CREATE POLICY "Anyone can view reviews"
  ON public.pet_store_reviews FOR SELECT
  USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Users can create reviews"
  ON public.pet_store_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON public.pet_store_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON public.pet_store_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- Trigger to auto-update rating_avg and rating_count on items
CREATE OR REPLACE FUNCTION public.update_item_rating_stats()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_item_id := OLD.item_id;
  ELSE
    v_item_id := NEW.item_id;
  END IF;

  UPDATE public.pet_store_items
  SET
    rating_avg = COALESCE((SELECT AVG(rating)::NUMERIC(3,2) FROM public.pet_store_reviews WHERE item_id = v_item_id), 0),
    rating_count = COALESCE((SELECT COUNT(*) FROM public.pet_store_reviews WHERE item_id = v_item_id), 0),
    updated_at = now()
  WHERE id = v_item_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_update_item_rating_stats
  AFTER INSERT OR UPDATE OR DELETE ON public.pet_store_reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.update_item_rating_stats();
