
-- Enums
DO $$ BEGIN
  CREATE TYPE public.platform_promotion_recipient_type AS ENUM ('merchant', 'vet', 'both');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.platform_promotion_status AS ENUM ('draft', 'active', 'archived');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.platform_promotion_invitation_status AS ENUM ('pending', 'accepted', 'declined');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Promotions table
CREATE TABLE IF NOT EXISTS public.platform_promotions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  perks text,
  reward_amount_usd numeric(10,2),
  recipient_type public.platform_promotion_recipient_type NOT NULL DEFAULT 'both',
  status public.platform_promotion_status NOT NULL DEFAULT 'draft',
  start_date date,
  end_date date,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Invitations table
CREATE TABLE IF NOT EXISTS public.platform_promotion_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  promotion_id uuid NOT NULL REFERENCES public.platform_promotions(id) ON DELETE CASCADE,
  recipient_type text NOT NULL CHECK (recipient_type IN ('merchant', 'vet')),
  recipient_id uuid NOT NULL,
  message text,
  status public.platform_promotion_invitation_status NOT NULL DEFAULT 'pending',
  invited_by uuid NOT NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (promotion_id, recipient_type, recipient_id)
);

CREATE INDEX IF NOT EXISTS idx_ppi_promotion ON public.platform_promotion_invitations(promotion_id);
CREATE INDEX IF NOT EXISTS idx_ppi_recipient ON public.platform_promotion_invitations(recipient_type, recipient_id);
CREATE INDEX IF NOT EXISTS idx_ppi_status ON public.platform_promotion_invitations(status);

-- updated_at trigger
CREATE TRIGGER trg_platform_promotions_updated
BEFORE UPDATE ON public.platform_promotions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER trg_platform_promotion_invitations_updated
BEFORE UPDATE ON public.platform_promotion_invitations
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.platform_promotions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.platform_promotion_invitations ENABLE ROW LEVEL SECURITY;

-- Admin-only on platform_promotions
CREATE POLICY "Admins manage platform_promotions"
  ON public.platform_promotions
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- Recipients can read their own active promotion (joined via invitation)
CREATE POLICY "Recipients view promos they were invited to"
  ON public.platform_promotions
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.platform_promotion_invitations i
      WHERE i.promotion_id = platform_promotions.id
        AND (
          (i.recipient_type = 'merchant' AND EXISTS (
             SELECT 1 FROM public.merchants m WHERE m.id = i.recipient_id AND m.user_id = auth.uid()
          ))
          OR (i.recipient_type = 'vet' AND EXISTS (
             SELECT 1 FROM public.partner_vets v WHERE v.id = i.recipient_id AND v.user_id = auth.uid()
          ))
        )
    )
  );

-- Invitations RLS
CREATE POLICY "Admins manage promotion invitations"
  ON public.platform_promotion_invitations
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

CREATE POLICY "Merchant recipients view their invitations"
  ON public.platform_promotion_invitations
  FOR SELECT
  TO authenticated
  USING (
    recipient_type = 'merchant'
    AND EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = recipient_id AND m.user_id = auth.uid())
  );

CREATE POLICY "Vet recipients view their invitations"
  ON public.platform_promotion_invitations
  FOR SELECT
  TO authenticated
  USING (
    recipient_type = 'vet'
    AND EXISTS (SELECT 1 FROM public.partner_vets v WHERE v.id = recipient_id AND v.user_id = auth.uid())
  );

-- Respond function
CREATE OR REPLACE FUNCTION public.respond_to_promotion_invitation(
  p_invitation_id uuid,
  p_accept boolean
) RETURNS public.platform_promotion_invitations
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.platform_promotion_invitations;
  v_owns boolean := false;
BEGIN
  SELECT * INTO v_inv FROM public.platform_promotion_invitations WHERE id = p_invitation_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invitation not found';
  END IF;

  IF v_inv.recipient_type = 'merchant' THEN
    SELECT EXISTS (SELECT 1 FROM public.merchants m WHERE m.id = v_inv.recipient_id AND m.user_id = auth.uid())
      INTO v_owns;
  ELSIF v_inv.recipient_type = 'vet' THEN
    SELECT EXISTS (SELECT 1 FROM public.partner_vets v WHERE v.id = v_inv.recipient_id AND v.user_id = auth.uid())
      INTO v_owns;
  END IF;

  IF NOT v_owns THEN
    RAISE EXCEPTION 'Not authorized to respond to this invitation';
  END IF;

  IF v_inv.status <> 'pending' THEN
    RAISE EXCEPTION 'Invitation already responded to';
  END IF;

  UPDATE public.platform_promotion_invitations
    SET status = CASE WHEN p_accept THEN 'accepted'::platform_promotion_invitation_status
                      ELSE 'declined'::platform_promotion_invitation_status END,
        responded_at = now()
    WHERE id = p_invitation_id
    RETURNING * INTO v_inv;

  RETURN v_inv;
END;
$$;

GRANT EXECUTE ON FUNCTION public.respond_to_promotion_invitation(uuid, boolean) TO authenticated;

-- Bulk invite function (admin-only)
CREATE OR REPLACE FUNCTION public.bulk_invite_to_promotion(
  p_promotion_id uuid,
  p_recipient_type text,            -- 'merchant' | 'vet'
  p_scope text,                     -- 'all' | 'specific'
  p_recipient_ids uuid[] DEFAULT NULL,
  p_message text DEFAULT NULL
) RETURNS TABLE(invited integer, skipped integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_invited integer := 0;
  v_skipped integer := 0;
  v_caller uuid := auth.uid();
  v_promo public.platform_promotions;
  rec record;
BEGIN
  IF NOT (public.has_role(v_caller, 'admin') OR public.has_role(v_caller, 'superadmin')) THEN
    RAISE EXCEPTION 'Admin access required';
  END IF;

  IF p_recipient_type NOT IN ('merchant', 'vet') THEN
    RAISE EXCEPTION 'Invalid recipient_type';
  END IF;
  IF p_scope NOT IN ('all', 'specific') THEN
    RAISE EXCEPTION 'Invalid scope';
  END IF;

  SELECT * INTO v_promo FROM public.platform_promotions WHERE id = p_promotion_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Promotion not found'; END IF;

  IF p_recipient_type = 'merchant' THEN
    FOR rec IN
      SELECT m.id FROM public.merchants m
      WHERE (p_scope = 'all') OR (p_scope = 'specific' AND m.id = ANY(p_recipient_ids))
    LOOP
      BEGIN
        INSERT INTO public.platform_promotion_invitations (promotion_id, recipient_type, recipient_id, message, invited_by)
        VALUES (p_promotion_id, 'merchant', rec.id, p_message, v_caller);
        v_invited := v_invited + 1;
      EXCEPTION WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
      END;
    END LOOP;
  ELSE
    FOR rec IN
      SELECT v.id FROM public.partner_vets v
      WHERE (p_scope = 'all') OR (p_scope = 'specific' AND v.id = ANY(p_recipient_ids))
    LOOP
      BEGIN
        INSERT INTO public.platform_promotion_invitations (promotion_id, recipient_type, recipient_id, message, invited_by)
        VALUES (p_promotion_id, 'vet', rec.id, p_message, v_caller);
        v_invited := v_invited + 1;
      EXCEPTION WHEN unique_violation THEN
        v_skipped := v_skipped + 1;
      END;
    END LOOP;
  END IF;

  RETURN QUERY SELECT v_invited, v_skipped;
END;
$$;

GRANT EXECUTE ON FUNCTION public.bulk_invite_to_promotion(uuid, text, text, uuid[], text) TO authenticated;

-- Notify trigger: insert into notifications when invitation created
CREATE OR REPLACE FUNCTION public.notify_promotion_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id uuid;
  v_title text;
  v_link text;
  v_promo_title text;
BEGIN
  SELECT title INTO v_promo_title FROM public.platform_promotions WHERE id = NEW.promotion_id;

  IF NEW.recipient_type = 'merchant' THEN
    SELECT user_id INTO v_user_id FROM public.merchants WHERE id = NEW.recipient_id;
    v_link := '/merchant-dashboard?tab=promotions';
  ELSE
    SELECT user_id INTO v_user_id FROM public.partner_vets WHERE id = NEW.recipient_id;
    v_link := '/vet-dashboard?tab=promotions';
  END IF;

  IF v_user_id IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, title, message, category, link_url)
    VALUES (
      v_user_id,
      '🎁 New Platform Promotion Invitation',
      'You''ve been invited to join the promotion: ' || COALESCE(v_promo_title, 'Untitled') || '. Review and accept or decline in your dashboard.',
      'transactional',
      v_link
    );
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_promotion_invitation
AFTER INSERT ON public.platform_promotion_invitations
FOR EACH ROW EXECUTE FUNCTION public.notify_promotion_invitation();
