
-- Create immutable date extraction function
CREATE OR REPLACE FUNCTION public.checkin_date(ts timestamptz)
RETURNS date
LANGUAGE sql
IMMUTABLE
AS $$ SELECT ts::date $$;

-- Clean up existing duplicates (keep earliest)
DELETE FROM checkins
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY merchant_id, user_id, checkin_date(checked_in_at)
      ORDER BY checked_in_at ASC
    ) as rn
    FROM checkins
    WHERE merchant_id IS NOT NULL
  ) sub WHERE rn > 1
);

DELETE FROM checkins
WHERE id IN (
  SELECT id FROM (
    SELECT id, ROW_NUMBER() OVER (
      PARTITION BY vet_id, user_id, checkin_date(checked_in_at)
      ORDER BY checked_in_at ASC
    ) as rn
    FROM checkins
    WHERE vet_id IS NOT NULL
  ) sub WHERE rn > 1
);

-- Add unique indexes using immutable function
CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_merchant_user_day
ON checkins (merchant_id, user_id, checkin_date(checked_in_at))
WHERE merchant_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_checkins_vet_user_day
ON checkins (vet_id, user_id, checkin_date(checked_in_at))
WHERE vet_id IS NOT NULL;

-- Update process_checkin to use ON CONFLICT
CREATE OR REPLACE FUNCTION public.process_checkin(p_token text, p_user_id uuid)
RETURNS TABLE(success boolean, entity_name text, entity_type text, message text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_merchant RECORD;
  v_vet RECORD;
  v_row_count integer;
BEGIN
  SELECT id, business_name INTO v_merchant FROM merchants WHERE checkin_qr_token = p_token;
  IF FOUND THEN
    INSERT INTO checkins (merchant_id, user_id, checkin_token)
    VALUES (v_merchant.id, p_user_id, p_token)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      RETURN QUERY SELECT FALSE, v_merchant.business_name, 'merchant'::TEXT, 'You have already checked in today'::TEXT;
      RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, v_merchant.business_name, 'merchant'::TEXT, 'Successfully checked in!'::TEXT;
    RETURN;
  END IF;

  SELECT id, clinic_name, name INTO v_vet FROM partner_vets WHERE checkin_qr_token = p_token;
  IF FOUND THEN
    INSERT INTO checkins (vet_id, user_id, checkin_token)
    VALUES (v_vet.id, p_user_id, p_token)
    ON CONFLICT DO NOTHING;

    GET DIAGNOSTICS v_row_count = ROW_COUNT;
    IF v_row_count = 0 THEN
      RETURN QUERY SELECT FALSE, COALESCE(v_vet.clinic_name, v_vet.name), 'vet'::TEXT, 'You have already checked in today'::TEXT;
      RETURN;
    END IF;

    RETURN QUERY SELECT TRUE, COALESCE(v_vet.clinic_name, v_vet.name), 'vet'::TEXT, 'Successfully checked in!'::TEXT;
    RETURN;
  END IF;

  RETURN QUERY SELECT FALSE, NULL::TEXT, NULL::TEXT, 'Invalid QR code'::TEXT;
END;
$$;
