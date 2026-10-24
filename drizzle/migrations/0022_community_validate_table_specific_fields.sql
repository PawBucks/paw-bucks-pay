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
IF TG_TABLE_NAME <> 'community_comments' THEN
IF NEW.media_path IS NOT NULL AND split_part(NEW.media_path,'/',1)<>NEW.author_id::text THEN RAISE EXCEPTION 'Invalid media owner'; END IF;
END IF;
RETURN NEW;
END $$;