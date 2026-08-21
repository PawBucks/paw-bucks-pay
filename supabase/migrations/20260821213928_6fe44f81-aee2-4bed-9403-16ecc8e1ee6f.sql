-- =========================================================
-- 1. TAX CATEGORIES (category -> Stripe tax code mapping)
-- =========================================================
CREATE TABLE public.tax_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  description TEXT,
  stripe_tax_code TEXT,
  applies_to TEXT NOT NULL DEFAULT 'both',
  requires_review BOOLEAN NOT NULL DEFAULT false,
  sort_order INTEGER NOT NULL DEFAULT 0,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_categories_applies_to_chk CHECK (applies_to IN ('product','service','both'))
);

GRANT SELECT ON public.tax_categories TO authenticated;
GRANT SELECT ON public.tax_categories TO anon;
GRANT ALL ON public.tax_categories TO service_role;
ALTER TABLE public.tax_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tax categories are readable by everyone"
  ON public.tax_categories FOR SELECT USING (true);

CREATE POLICY "Admins manage tax categories"
  ON public.tax_categories FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- =========================================================
-- 2. TAX CONFIG ON CATALOG ITEMS
-- =========================================================
ALTER TABLE public.pet_store_items
  ADD COLUMN IF NOT EXISTS tax_category_key TEXT REFERENCES public.tax_categories(key),
  ADD COLUMN IF NOT EXISTS tax_behavior TEXT NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN,
  ADD COLUMN IF NOT EXISTS tax_review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.merchant_services
  ADD COLUMN IF NOT EXISTS tax_category_key TEXT REFERENCES public.tax_categories(key),
  ADD COLUMN IF NOT EXISTS tax_behavior TEXT NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN,
  ADD COLUMN IF NOT EXISTS tax_review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.invoice_catalog_items
  ADD COLUMN IF NOT EXISTS tax_category_key TEXT REFERENCES public.tax_categories(key),
  ADD COLUMN IF NOT EXISTS tax_behavior TEXT NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN,
  ADD COLUMN IF NOT EXISTS tax_review_required BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public.merchant_market_services
  ADD COLUMN IF NOT EXISTS tax_category_key TEXT REFERENCES public.tax_categories(key),
  ADD COLUMN IF NOT EXISTS tax_behavior TEXT NOT NULL DEFAULT 'exclusive',
  ADD COLUMN IF NOT EXISTS taxable BOOLEAN,
  ADD COLUMN IF NOT EXISTS tax_review_required BOOLEAN NOT NULL DEFAULT false;

-- =========================================================
-- 3. CUSTOMER TAX ADDRESSES
-- =========================================================
CREATE TABLE public.customer_tax_addresses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  kind TEXT NOT NULL DEFAULT 'billing',
  line1 TEXT NOT NULL,
  line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  postal_code TEXT NOT NULL,
  country TEXT NOT NULL DEFAULT 'US',
  is_default BOOLEAN NOT NULL DEFAULT false,
  validated_at TIMESTAMPTZ,
  validation_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT customer_tax_addresses_kind_chk CHECK (kind IN ('billing','shipping','service'))
);

CREATE INDEX idx_customer_tax_addresses_user ON public.customer_tax_addresses(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_tax_addresses TO authenticated;
GRANT ALL ON public.customer_tax_addresses TO service_role;
ALTER TABLE public.customer_tax_addresses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own tax addresses"
  ON public.customer_tax_addresses FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- =========================================================
-- 4. TAX CALCULATIONS (audit trail)
-- =========================================================
CREATE TABLE public.tax_calculations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  stripe_tax_calculation_id TEXT,
  stripe_tax_transaction_id TEXT,
  stripe_payment_intent_id TEXT,
  connected_account_id TEXT,
  user_id UUID,
  merchant_id UUID REFERENCES public.merchants(id) ON DELETE SET NULL,
  transaction_id UUID,
  order_id UUID,
  invoice_id UUID,
  context TEXT NOT NULL DEFAULT 'merchant_payment',
  tax_collection_mode TEXT NOT NULL DEFAULT 'merchant',
  currency TEXT NOT NULL DEFAULT 'usd',
  subtotal_cents INTEGER NOT NULL DEFAULT 0,
  taxable_amount_cents INTEGER NOT NULL DEFAULT 0,
  exempt_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  total_cents INTEGER NOT NULL DEFAULT 0,
  effective_tax_rate NUMERIC,
  address JSONB,
  jurisdictions JSONB NOT NULL DEFAULT '[]'::jsonb,
  stripe_response JSONB,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_calculations_status_chk CHECK (status IN ('pending','committed','failed','reversed','partially_reversed','expired')),
  CONSTRAINT tax_calculations_mode_chk CHECK (tax_collection_mode IN ('marketplace','merchant','platform'))
);

CREATE INDEX idx_tax_calculations_user ON public.tax_calculations(user_id);
CREATE INDEX idx_tax_calculations_merchant ON public.tax_calculations(merchant_id);
CREATE INDEX idx_tax_calculations_pi ON public.tax_calculations(stripe_payment_intent_id);
CREATE INDEX idx_tax_calculations_created ON public.tax_calculations(created_at DESC);

GRANT SELECT ON public.tax_calculations TO authenticated;
GRANT ALL ON public.tax_calculations TO service_role;
ALTER TABLE public.tax_calculations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view their own tax calculations"
  ON public.tax_calculations FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Merchants view tax calculations for their sales"
  ON public.tax_calculations FOR SELECT TO authenticated
  USING (merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid()));

CREATE POLICY "Admins view all tax calculations"
  ON public.tax_calculations FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin'));

-- =========================================================
-- 5. TAX CALCULATION LINE ITEMS
-- =========================================================
CREATE TABLE public.tax_calculation_line_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_calculation_id UUID NOT NULL REFERENCES public.tax_calculations(id) ON DELETE CASCADE,
  stripe_line_item_id TEXT,
  reference TEXT,
  source_type TEXT,
  source_id UUID,
  name TEXT NOT NULL,
  tax_category_key TEXT,
  stripe_tax_code TEXT,
  tax_behavior TEXT NOT NULL DEFAULT 'exclusive',
  quantity NUMERIC NOT NULL DEFAULT 1,
  amount_cents INTEGER NOT NULL DEFAULT 0,
  taxable_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  tax_rate NUMERIC,
  jurisdiction JSONB,
  tax_breakdown JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tax_calc_line_items_calc ON public.tax_calculation_line_items(tax_calculation_id);

GRANT SELECT ON public.tax_calculation_line_items TO authenticated;
GRANT ALL ON public.tax_calculation_line_items TO service_role;
ALTER TABLE public.tax_calculation_line_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tax line items follow their calculation"
  ON public.tax_calculation_line_items FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tax_calculations c
    WHERE c.id = tax_calculation_id
      AND (
        c.user_id = auth.uid()
        OR c.merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'superadmin')
      )
  ));

-- =========================================================
-- 6. TAX REVERSALS (refunds / cancellations)
-- =========================================================
CREATE TABLE public.tax_reversals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  tax_calculation_id UUID NOT NULL REFERENCES public.tax_calculations(id) ON DELETE CASCADE,
  stripe_tax_transaction_id TEXT,
  stripe_reversal_transaction_id TEXT,
  stripe_refund_id TEXT,
  mode TEXT NOT NULL DEFAULT 'partial',
  reversed_taxable_amount_cents INTEGER NOT NULL DEFAULT 0,
  reversed_tax_amount_cents INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tax_reversals_mode_chk CHECK (mode IN ('full','partial','cancellation'))
);

CREATE INDEX idx_tax_reversals_calc ON public.tax_reversals(tax_calculation_id);

GRANT SELECT ON public.tax_reversals TO authenticated;
GRANT ALL ON public.tax_reversals TO service_role;
ALTER TABLE public.tax_reversals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tax reversals follow their calculation"
  ON public.tax_reversals FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tax_calculations c
    WHERE c.id = tax_calculation_id
      AND (
        c.user_id = auth.uid()
        OR c.merchant_id IN (SELECT id FROM public.merchants WHERE user_id = auth.uid())
        OR public.has_role(auth.uid(), 'admin')
        OR public.has_role(auth.uid(), 'superadmin')
      )
  ));

-- =========================================================
-- 7. TAX TOTALS ON MONEY RECORDS
-- =========================================================
ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS tax_amount NUMERIC NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_calculation_id UUID;

ALTER TABLE public.direct_payments
  ADD COLUMN IF NOT EXISTS tax_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_calculation_id UUID;

ALTER TABLE public.pet_store_orders
  ADD COLUMN IF NOT EXISTS tax_amount INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tax_calculation_id UUID,
  ADD COLUMN IF NOT EXISTS subtotal_amount INTEGER;

-- =========================================================
-- 8. UPDATED_AT TRIGGERS
-- =========================================================
CREATE TRIGGER update_tax_categories_updated_at
  BEFORE UPDATE ON public.tax_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_tax_addresses_updated_at
  BEFORE UPDATE ON public.customer_tax_addresses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tax_calculations_updated_at
  BEFORE UPDATE ON public.tax_calculations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- 9. ADMIN TAX REPORT
-- =========================================================
CREATE OR REPLACE FUNCTION public.get_tax_report(
  p_start TIMESTAMPTZ DEFAULT (now() - interval '30 days'),
  p_end TIMESTAMPTZ DEFAULT now()
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'superadmin')) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  SELECT jsonb_build_object(
    'range', jsonb_build_object('start', p_start, 'end', p_end),
    'summary', COALESCE((
      SELECT jsonb_build_object(
        'calculations', count(*),
        'taxable_sales_cents', COALESCE(sum(c.taxable_amount_cents), 0),
        'exempt_sales_cents', COALESCE(sum(c.exempt_amount_cents), 0),
        'tax_collected_cents', COALESCE(sum(c.tax_amount_cents), 0),
        'tax_reversed_cents', COALESCE((
          SELECT sum(r.reversed_tax_amount_cents) FROM public.tax_reversals r
          JOIN public.tax_calculations tc ON tc.id = r.tax_calculation_id
          WHERE tc.created_at >= p_start AND tc.created_at <= p_end
        ), 0)
      )
      FROM public.tax_calculations c
      WHERE c.created_at >= p_start AND c.created_at <= p_end
        AND c.status IN ('committed','reversed','partially_reversed')
    ), '{}'::jsonb),
    'by_jurisdiction', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT COALESCE(li.jurisdiction->>'display_name', 'Unknown') AS jurisdiction,
               sum(li.taxable_amount_cents) AS taxable_amount_cents,
               sum(li.tax_amount_cents) AS tax_amount_cents
        FROM public.tax_calculation_line_items li
        JOIN public.tax_calculations c ON c.id = li.tax_calculation_id
        WHERE c.created_at >= p_start AND c.created_at <= p_end
          AND c.status IN ('committed','reversed','partially_reversed')
        GROUP BY 1 ORDER BY 3 DESC
      ) x
    ), '[]'::jsonb),
    'by_merchant', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT c.merchant_id,
               COALESCE(m.business_name, 'PawBucks Store') AS merchant_name,
               sum(c.taxable_amount_cents) AS taxable_amount_cents,
               sum(c.tax_amount_cents) AS tax_amount_cents
        FROM public.tax_calculations c
        LEFT JOIN public.merchants m ON m.id = c.merchant_id
        WHERE c.created_at >= p_start AND c.created_at <= p_end
          AND c.status IN ('committed','reversed','partially_reversed')
        GROUP BY 1, 2 ORDER BY 4 DESC
      ) x
    ), '[]'::jsonb),
    'by_category', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT COALESCE(li.tax_category_key, 'unclassified') AS category,
               sum(li.taxable_amount_cents) AS taxable_amount_cents,
               sum(li.tax_amount_cents) AS tax_amount_cents
        FROM public.tax_calculation_line_items li
        JOIN public.tax_calculations c ON c.id = li.tax_calculation_id
        WHERE c.created_at >= p_start AND c.created_at <= p_end
          AND c.status IN ('committed','reversed','partially_reversed')
        GROUP BY 1 ORDER BY 3 DESC
      ) x
    ), '[]'::jsonb),
    'by_day', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT (c.created_at AT TIME ZONE 'America/New_York')::date AS day,
               sum(c.taxable_amount_cents) AS taxable_amount_cents,
               sum(c.tax_amount_cents) AS tax_amount_cents
        FROM public.tax_calculations c
        WHERE c.created_at >= p_start AND c.created_at <= p_end
          AND c.status IN ('committed','reversed','partially_reversed')
        GROUP BY 1 ORDER BY 1
      ) x
    ), '[]'::jsonb),
    'transactions', COALESCE((
      SELECT jsonb_agg(x) FROM (
        SELECT c.id,
               c.created_at,
               COALESCE(m.business_name, 'PawBucks Store') AS merchant_name,
               p.full_name AS customer_name,
               c.context,
               c.tax_collection_mode,
               c.taxable_amount_cents,
               c.tax_amount_cents,
               c.effective_tax_rate,
               c.jurisdictions,
               c.stripe_tax_calculation_id,
               c.stripe_payment_intent_id,
               c.status
        FROM public.tax_calculations c
        LEFT JOIN public.merchants m ON m.id = c.merchant_id
        LEFT JOIN public.profiles p ON p.id = c.user_id
        WHERE c.created_at >= p_start AND c.created_at <= p_end
        ORDER BY c.created_at DESC
        LIMIT 500
      ) x
    ), '[]'::jsonb)
  ) INTO v_result;

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.get_tax_report(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_tax_report(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
