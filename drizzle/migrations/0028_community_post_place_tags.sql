ALTER TABLE public.community_posts
  ADD COLUMN IF NOT EXISTS tagged_type text CHECK (tagged_type IS NULL OR tagged_type IN ('merchant','guide_place')),
  ADD COLUMN IF NOT EXISTS tagged_id uuid,
  ADD COLUMN IF NOT EXISTS tagged_label text CHECK (tagged_label IS NULL OR char_length(tagged_label) <= 160);

CREATE OR REPLACE FUNCTION public.community_posts_resolve_tag()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_label text;
BEGIN
  IF NEW.tagged_type IS NULL OR NEW.tagged_id IS NULL THEN
    NEW.tagged_type := NULL; NEW.tagged_id := NULL; NEW.tagged_label := NULL;
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND NEW.tagged_type IS NOT DISTINCT FROM OLD.tagged_type AND NEW.tagged_id IS NOT DISTINCT FROM OLD.tagged_id THEN
    NEW.tagged_label := OLD.tagged_label;
    RETURN NEW;
  END IF;
  IF NEW.tagged_type = 'merchant' THEN
    SELECT business_name INTO v_label FROM public.merchants WHERE id = NEW.tagged_id;
  ELSE
    SELECT name INTO v_label FROM public.guide_places WHERE id = NEW.tagged_id AND COALESCE(is_active, true);
  END IF;
  IF v_label IS NULL THEN RAISE EXCEPTION 'Tagged place or business was not found'; END IF;
  NEW.tagged_label := left(v_label, 160);
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS community_posts_resolve_tag ON public.community_posts;
CREATE TRIGGER community_posts_resolve_tag BEFORE INSERT OR UPDATE ON public.community_posts
FOR EACH ROW EXECUTE FUNCTION public.community_posts_resolve_tag();