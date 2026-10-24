ALTER TABLE public.community_posts ADD COLUMN post_kind text NOT NULL DEFAULT 'update', ADD COLUMN pet_id uuid REFERENCES public.pet_profiles(id) ON DELETE SET NULL, ADD COLUMN pet_name text, ADD COLUMN location_label text, ADD COLUMN media_path text, ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.community_comments ADD COLUMN is_hidden boolean NOT NULL DEFAULT false;
ALTER TABLE public.guide_places ADD COLUMN leash_rules text, ADD COLUMN amenities text[] NOT NULL DEFAULT '{}', ADD COLUMN access_restrictions text, ADD COLUMN official_url text, ADD COLUMN verified_at timestamptz;
CREATE TABLE public.community_blocks (blocker_id uuid NOT NULL, blocked_id uuid NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY(blocker_id,blocked_id), CHECK(blocker_id <> blocked_id));
GRANT SELECT,INSERT,DELETE ON public.community_blocks TO authenticated; GRANT ALL ON public.community_blocks TO service_role;
ALTER TABLE public.community_blocks ENABLE ROW LEVEL SECURITY;
CREATE POLICY blocks_own_read ON public.community_blocks FOR SELECT TO authenticated USING(blocker_id=auth.uid());
CREATE POLICY blocks_own_insert ON public.community_blocks FOR INSERT TO authenticated WITH CHECK(blocker_id=auth.uid() AND NOT public.is_user_banned(auth.uid()));
CREATE POLICY blocks_own_delete ON public.community_blocks FOR DELETE TO authenticated USING(blocker_id=auth.uid());
CREATE OR REPLACE FUNCTION public.community_is_blocked(other_id uuid) RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM public.community_blocks WHERE (blocker_id=auth.uid() AND blocked_id=other_id) OR (blocked_id=auth.uid() AND blocker_id=other_id)); $$;
REVOKE ALL ON FUNCTION public.community_is_blocked(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.community_is_blocked(uuid) TO authenticated;
CREATE TABLE public.guide_place_tips (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), place_id uuid NOT NULL REFERENCES public.guide_places(id) ON DELETE CASCADE, author_id uuid NOT NULL, author_name text NOT NULL DEFAULT 'Member', text text NOT NULL, media_path text, is_hidden boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
GRANT SELECT,INSERT,DELETE ON public.guide_place_tips TO authenticated; GRANT ALL ON public.guide_place_tips TO service_role;
ALTER TABLE public.guide_place_tips ENABLE ROW LEVEL SECURITY;
CREATE POLICY tips_read ON public.guide_place_tips FOR SELECT TO authenticated USING(NOT is_hidden AND NOT public.community_is_blocked(author_id) AND NOT public.is_user_banned(auth.uid()));
CREATE POLICY tips_insert ON public.guide_place_tips FOR INSERT TO authenticated WITH CHECK(author_id=auth.uid() AND NOT public.is_user_banned(auth.uid()) AND EXISTS(SELECT 1 FROM public.guide_places p WHERE p.id=place_id AND p.is_active));
CREATE POLICY tips_delete ON public.guide_place_tips FOR DELETE TO authenticated USING(author_id=auth.uid());
CREATE TABLE public.community_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), reporter_id uuid NOT NULL, target_type text NOT NULL CHECK(target_type IN ('post','comment','tip')), target_id uuid NOT NULL, target_author_id uuid NOT NULL, reason text NOT NULL CHECK(reason IN ('spam','harassment','unsafe','misinformation','other')), details text NOT NULL DEFAULT '', status text NOT NULL DEFAULT 'open' CHECK(status IN ('open','dismissed','removed')), created_at timestamptz NOT NULL DEFAULT now(), resolved_at timestamptz, UNIQUE(reporter_id,target_type,target_id));
GRANT SELECT,INSERT ON public.community_reports TO authenticated; GRANT ALL ON public.community_reports TO service_role;
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY reports_read ON public.community_reports FOR SELECT TO authenticated USING(reporter_id=auth.uid() OR public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin'));
CREATE POLICY reports_insert ON public.community_reports FOR INSERT TO authenticated WITH CHECK(reporter_id=auth.uid() AND status='open' AND resolved_at IS NULL AND NOT public.is_user_banned(auth.uid()) AND ((target_type='post' AND EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=target_id AND p.author_id=target_author_id)) OR (target_type='comment' AND EXISTS(SELECT 1 FROM public.community_comments c WHERE c.id=target_id AND c.author_id=target_author_id)) OR (target_type='tip' AND EXISTS(SELECT 1 FROM public.guide_place_tips t WHERE t.id=target_id AND t.author_id=target_author_id))));
CREATE INDEX community_blocks_reverse ON public.community_blocks(blocked_id,blocker_id);
CREATE INDEX guide_tips_place_date ON public.guide_place_tips(place_id,created_at DESC);
CREATE INDEX community_reports_open ON public.community_reports(status,created_at);
CREATE POLICY posts_safety_read ON public.community_posts AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT is_hidden AND NOT public.community_is_blocked(author_id));
CREATE POLICY comments_safety_read ON public.community_comments AS RESTRICTIVE FOR SELECT TO authenticated USING(NOT is_hidden AND NOT public.community_is_blocked(author_id) AND EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id));
CREATE POLICY comments_safety_insert ON public.community_comments AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_hidden AND NOT public.is_user_banned(auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id));
CREATE POLICY likes_safety_insert ON public.community_likes AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT public.is_user_banned(auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id));
CREATE POLICY saves_safety_insert ON public.community_saves AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT public.is_user_banned(auth.uid()) AND EXISTS(SELECT 1 FROM public.community_posts p WHERE p.id=post_id));
CREATE OR REPLACE FUNCTION public.community_validate_content() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE display_name text; photo text; kind public.community_author_role; pn text;
BEGIN
IF auth.uid() IS NOT NULL AND (NEW.author_id<>auth.uid() OR public.is_user_banned(auth.uid())) THEN RAISE EXCEPTION 'Not authorized'; END IF;
IF length(trim(NEW.text))=0 OR length(NEW.text)>4000 THEN RAISE EXCEPTION 'Content must be between 1 and 4000 characters'; END IF;
SELECT COALESCE(full_name,'Member'),avatar_url,CASE WHEN user_type='merchant' THEN 'merchant'::public.community_author_role ELSE 'pet_owner'::public.community_author_role END INTO display_name,photo,kind FROM public.profiles WHERE id=NEW.author_id;
NEW.author_name:=COALESCE(display_name,'Member');
IF TG_TABLE_NAME <> 'guide_place_tips' THEN NEW.author_photo_url:=photo; NEW.author_role:=COALESCE(kind,'pet_owner'); END IF;
IF TG_TABLE_NAME='community_posts' THEN
IF NEW.post_kind NOT IN ('update','milestone','funny','question') OR length(COALESCE(NEW.location_label,''))>120 THEN RAISE EXCEPTION 'Invalid post details'; END IF;
IF NEW.pet_id IS NOT NULL THEN SELECT name INTO pn FROM public.pet_profiles WHERE id=NEW.pet_id AND user_id=NEW.author_id; IF pn IS NULL THEN RAISE EXCEPTION 'Choose your own pet'; END IF; NEW.pet_name:=pn; ELSE NEW.pet_name:=NULL; END IF;
IF auth.uid() IS NOT NULL AND ((TG_OP='INSERT' AND NEW.is_hidden) OR (TG_OP='UPDATE' AND NEW.is_hidden IS DISTINCT FROM OLD.is_hidden)) THEN RAISE EXCEPTION 'Moderation is server controlled'; END IF;
END IF;
IF TG_TABLE_NAME <> 'community_comments' AND NEW.media_path IS NOT NULL AND split_part(NEW.media_path,'/',1)<>NEW.author_id::text THEN RAISE EXCEPTION 'Invalid media owner'; END IF;
RETURN NEW;
END $$;
CREATE TRIGGER community_posts_validate BEFORE INSERT OR UPDATE ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.community_validate_content();
CREATE TRIGGER community_comments_validate BEFORE INSERT ON public.community_comments FOR EACH ROW EXECUTE FUNCTION public.community_validate_content();
CREATE TRIGGER guide_tips_validate BEFORE INSERT ON public.guide_place_tips FOR EACH ROW EXECUTE FUNCTION public.community_validate_content();
CREATE OR REPLACE FUNCTION public.community_moderate_report(report_id uuid, action text) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.community_reports;
BEGIN
IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
IF action NOT IN ('dismiss','remove') THEN RAISE EXCEPTION 'Invalid action'; END IF;
SELECT * INTO r FROM public.community_reports WHERE id=report_id FOR UPDATE; IF NOT FOUND THEN RAISE EXCEPTION 'Report not found'; END IF;
IF action='remove' THEN
-- Updates are guarded in this function; temporarily bypass the author validation trigger with a transaction-local moderator flag.
PERFORM set_config('app.community_moderator','true',true);
IF r.target_type='post' THEN UPDATE public.community_posts SET is_hidden=true WHERE id=r.target_id;
ELSIF r.target_type='comment' THEN UPDATE public.community_comments SET is_hidden=true WHERE id=r.target_id;
ELSE UPDATE public.guide_place_tips SET is_hidden=true WHERE id=r.target_id; END IF;
END IF;
UPDATE public.community_reports SET status=CASE WHEN action='remove' THEN 'removed' ELSE 'dismissed' END,resolved_at=now() WHERE id=report_id;
END $$;
REVOKE ALL ON FUNCTION public.community_moderate_report(uuid,text) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.community_moderate_report(uuid,text) TO authenticated;
-- Only an authenticated moderator inside the guarded RPC may bypass author validation.
CREATE OR REPLACE FUNCTION public.community_validate_content() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE display_name text; photo text; kind public.community_author_role; pn text;
BEGIN
IF current_setting('app.community_moderator',true)='true' AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RETURN NEW; END IF;
IF auth.uid() IS NOT NULL AND (NEW.author_id<>auth.uid() OR public.is_user_banned(auth.uid())) THEN RAISE EXCEPTION 'Not authorized'; END IF;
IF length(trim(NEW.text))=0 OR length(NEW.text)>4000 THEN RAISE EXCEPTION 'Content must be between 1 and 4000 characters'; END IF;
SELECT COALESCE(full_name,'Member'),avatar_url,CASE WHEN user_type='merchant' THEN 'merchant'::public.community_author_role ELSE 'pet_owner'::public.community_author_role END INTO display_name,photo,kind FROM public.profiles WHERE id=NEW.author_id;
NEW.author_name:=COALESCE(display_name,'Member');
IF TG_TABLE_NAME <> 'guide_place_tips' THEN NEW.author_photo_url:=photo; NEW.author_role:=COALESCE(kind,'pet_owner'); END IF;
IF TG_TABLE_NAME='community_posts' THEN
IF NEW.post_kind NOT IN ('update','milestone','funny','question') OR length(COALESCE(NEW.location_label,''))>120 THEN RAISE EXCEPTION 'Invalid post details'; END IF;
IF NEW.pet_id IS NOT NULL THEN SELECT name INTO pn FROM public.pet_profiles WHERE id=NEW.pet_id AND user_id=NEW.author_id; IF pn IS NULL THEN RAISE EXCEPTION 'Choose your own pet'; END IF; NEW.pet_name:=pn; ELSE NEW.pet_name:=NULL; END IF;
IF auth.uid() IS NOT NULL AND ((TG_OP='INSERT' AND NEW.is_hidden) OR (TG_OP='UPDATE' AND NEW.is_hidden IS DISTINCT FROM OLD.is_hidden)) THEN RAISE EXCEPTION 'Moderation is server controlled'; END IF;
END IF;
IF TG_TABLE_NAME <> 'community_comments' AND NEW.media_path IS NOT NULL AND split_part(NEW.media_path,'/',1)<>NEW.author_id::text THEN RAISE EXCEPTION 'Invalid media owner'; END IF;
RETURN NEW;
END $$;
CREATE POLICY community_media_upload ON storage.objects FOR INSERT TO authenticated WITH CHECK(bucket_id='community-media' AND (storage.foldername(name))[1]=auth.uid()::text AND NOT public.is_user_banned(auth.uid()));
CREATE POLICY community_media_delete ON storage.objects FOR DELETE TO authenticated USING(bucket_id='community-media' AND (storage.foldername(name))[1]=auth.uid()::text);
CREATE POLICY community_media_read ON storage.objects FOR SELECT TO authenticated USING(bucket_id='community-media' AND ((storage.foldername(name))[1]=auth.uid()::text OR EXISTS(SELECT 1 FROM public.community_posts p WHERE p.media_path=name) OR EXISTS(SELECT 1 FROM public.guide_place_tips t WHERE t.media_path=name)));
