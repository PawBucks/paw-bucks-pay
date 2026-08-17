-- Enforce column-level UPDATE permissions so privileged fields cannot be
-- self-modified by merchants/vets/users (defense in depth alongside triggers).

DO $$
DECLARE
  col text;
  merchant_blocked text[] := ARRAY[
    'approval_status','approved_at','approved_by','denial_reason',
    'is_sponsored','sponsored_until','cashback_rate','fee_model',
    'stripe_account_status','acquisition_fee_rate',
    'pawbucks_cap_enabled','pawbucks_cap_pct','pawbucks_promo_cap_pct',
    'pawbucks_promo_starts_at','pawbucks_promo_ends_at',
    'is_paused','paused_at','paused_by','pause_reason','funding_status'
  ];
  vet_blocked text[] := ARRAY[
    'approval_status','approved_at','approved_by','denial_reason',
    'is_verified','subscription_tier','user_id',
    'stripe_account_id','stripe_connect_account_id'
  ];
  profile_blocked text[] := ARRAY[
    'id','is_banned','banned_at','banned_by','banned_reason',
    'user_type','email','normalized_email','phone_verified','stripe_customer_id'
  ];
BEGIN
  -- merchants
  REVOKE UPDATE ON public.merchants FROM authenticated;
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='merchants'
      AND NOT (column_name = ANY(merchant_blocked))
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.merchants TO authenticated', col);
  END LOOP;

  -- partner_vets
  REVOKE UPDATE ON public.partner_vets FROM authenticated;
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='partner_vets'
      AND NOT (column_name = ANY(vet_blocked))
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.partner_vets TO authenticated', col);
  END LOOP;

  -- profiles
  REVOKE UPDATE ON public.profiles FROM authenticated;
  FOR col IN
    SELECT column_name FROM information_schema.columns
    WHERE table_schema='public' AND table_name='profiles'
      AND NOT (column_name = ANY(profile_blocked))
  LOOP
    EXECUTE format('GRANT UPDATE (%I) ON public.profiles TO authenticated', col);
  END LOOP;
END $$;

-- anon should never update these tables
REVOKE UPDATE ON public.merchants FROM anon;
REVOKE UPDATE ON public.partner_vets FROM anon;
REVOKE UPDATE ON public.profiles FROM anon;

-- backend/admin paths keep full access
GRANT ALL ON public.merchants TO service_role;
GRANT ALL ON public.partner_vets TO service_role;
GRANT ALL ON public.profiles TO service_role;

-- Ensure self-update policies also constrain the new row to the same owner
DO $$
DECLARE p record;
BEGIN
  FOR p IN
    SELECT policyname, tablename FROM pg_policies
    WHERE schemaname='public'
      AND tablename IN ('merchants','partner_vets','profiles')
      AND cmd='UPDATE'
      AND with_check IS NULL
  LOOP
    IF p.tablename = 'profiles' THEN
      EXECUTE format('ALTER POLICY %I ON public.profiles WITH CHECK (auth.uid() = id)', p.policyname);
    ELSE
      EXECUTE format('ALTER POLICY %I ON public.%I WITH CHECK (auth.uid() = user_id)', p.policyname, p.tablename);
    END IF;
  END LOOP;
END $$;