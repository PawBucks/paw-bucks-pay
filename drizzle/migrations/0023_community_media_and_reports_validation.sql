CREATE OR REPLACE FUNCTION public.community_validate_media_reference() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
DECLARE path text;
BEGIN
path:=NEW.media_path;
IF path IS NOT NULL AND NOT EXISTS(SELECT 1 FROM storage.objects WHERE bucket_id='community-media' AND name=path AND (storage.foldername(name))[1]=NEW.author_id::text) THEN RAISE EXCEPTION 'Upload your own media before publishing'; END IF;
IF TG_TABLE_NAME='community_posts' AND auth.uid() IS NOT NULL THEN
IF TG_OP='INSERT' AND NEW.media_url IS NOT NULL THEN RAISE EXCEPTION 'Use a media upload'; END IF;
IF TG_OP='UPDATE' AND NEW.media_url IS DISTINCT FROM OLD.media_url THEN RAISE EXCEPTION 'Use a media upload'; END IF;
END IF;
RETURN NEW;
END $$;
CREATE TRIGGER community_posts_media_validate BEFORE INSERT OR UPDATE OF media_path,media_url ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.community_validate_media_reference();
CREATE TRIGGER guide_tips_media_validate BEFORE INSERT ON public.guide_place_tips FOR EACH ROW EXECUTE FUNCTION public.community_validate_media_reference();
ALTER TABLE public.community_reports ADD CONSTRAINT community_report_details_length CHECK(length(details)<=2000);
ALTER TABLE public.community_comments ADD CONSTRAINT community_comment_length CHECK(length(text)<=2000) NOT VALID;
