DROP TRIGGER community_posts_validate ON public.community_posts;
CREATE TRIGGER community_posts_validate BEFORE INSERT OR UPDATE OF text,author_id,author_name,author_role,author_photo_url,post_kind,pet_id,pet_name,location_label,media_path,media_url,media_type,is_hidden ON public.community_posts FOR EACH ROW EXECUTE FUNCTION public.community_validate_content();
CREATE POLICY tips_restrict_insert ON public.guide_place_tips AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_hidden);
CREATE POLICY posts_restrict_insert ON public.community_posts AS RESTRICTIVE FOR INSERT TO authenticated WITH CHECK(NOT is_hidden);
CREATE OR REPLACE FUNCTION public.community_report_content(report_uuid uuid) RETURNS text LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path=public AS $$
DECLARE r public.community_reports; result text;
BEGIN
IF NOT (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'superadmin')) THEN RAISE EXCEPTION 'Not authorized'; END IF;
SELECT * INTO r FROM public.community_reports WHERE id=report_uuid;
IF r.target_type='post' THEN SELECT text INTO result FROM public.community_posts WHERE id=r.target_id;
ELSIF r.target_type='comment' THEN SELECT text INTO result FROM public.community_comments WHERE id=r.target_id;
ELSE SELECT text INTO result FROM public.guide_place_tips WHERE id=r.target_id; END IF;
RETURN result;
END $$;
REVOKE ALL ON FUNCTION public.community_report_content(uuid) FROM PUBLIC; GRANT EXECUTE ON FUNCTION public.community_report_content(uuid) TO authenticated;