-- Badge Promotions: Links guilt badges to pet store items with promotional pricing
CREATE TABLE public.badge_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  badge_id UUID NOT NULL REFERENCES public.guilt_badge_definitions(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  discount_percentage INTEGER NOT NULL CHECK (discount_percentage >= 1 AND discount_percentage <= 90),
  duration_hours INTEGER NOT NULL DEFAULT 48 CHECK (duration_hours >= 24 AND duration_hours <= 72),
  is_active BOOLEAN NOT NULL DEFAULT true,
  start_date TIMESTAMPTZ,
  end_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users(id)
);

-- Junction table for promotion items
CREATE TABLE public.badge_promotion_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id UUID NOT NULL REFERENCES public.badge_promotions(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES public.pet_store_items(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(promotion_id, item_id)
);

-- Track active user promotions (when a user earns a badge, they get access to the promotion)
CREATE TABLE public.user_badge_promotions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  promotion_id UUID NOT NULL REFERENCES public.badge_promotions(id) ON DELETE CASCADE,
  user_badge_id UUID NOT NULL REFERENCES public.user_guilt_badges(id) ON DELETE CASCADE,
  activated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  is_used BOOLEAN NOT NULL DEFAULT false,
  used_at TIMESTAMPTZ,
  UNIQUE(user_id, promotion_id, user_badge_id)
);

-- Enable RLS
ALTER TABLE public.badge_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.badge_promotion_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_badge_promotions ENABLE ROW LEVEL SECURITY;

-- RLS Policies for badge_promotions (admins can manage, everyone can view active)
CREATE POLICY "Admins can manage badge promotions"
ON public.badge_promotions FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Everyone can view active badge promotions"
ON public.badge_promotions FOR SELECT
USING (is_active = true AND (start_date IS NULL OR start_date <= now()) AND (end_date IS NULL OR end_date > now()));

-- RLS Policies for badge_promotion_items
CREATE POLICY "Admins can manage badge promotion items"
ON public.badge_promotion_items FOR ALL
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Everyone can view promotion items"
ON public.badge_promotion_items FOR SELECT
USING (true);

-- RLS Policies for user_badge_promotions
CREATE POLICY "Users can view their own badge promotions"
ON public.user_badge_promotions FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "System can insert user badge promotions"
ON public.user_badge_promotions FOR INSERT
WITH CHECK (true);

CREATE POLICY "System can update user badge promotions"
ON public.user_badge_promotions FOR UPDATE
USING (true);

-- Updated at trigger
CREATE TRIGGER update_badge_promotions_updated_at
BEFORE UPDATE ON public.badge_promotions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for performance
CREATE INDEX idx_badge_promotions_badge_id ON public.badge_promotions(badge_id);
CREATE INDEX idx_badge_promotions_active ON public.badge_promotions(is_active) WHERE is_active = true;
CREATE INDEX idx_badge_promotion_items_promotion_id ON public.badge_promotion_items(promotion_id);
CREATE INDEX idx_badge_promotion_items_item_id ON public.badge_promotion_items(item_id);
CREATE INDEX idx_user_badge_promotions_user_id ON public.user_badge_promotions(user_id);
CREATE INDEX idx_user_badge_promotions_expires_at ON public.user_badge_promotions(expires_at) WHERE is_used = false;