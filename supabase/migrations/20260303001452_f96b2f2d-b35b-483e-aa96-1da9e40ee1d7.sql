
-- Spotlight: global cap across ALL geo cells (not per-cell)
-- Add a table for launch-zone-wide service caps
CREATE TABLE IF NOT EXISTS public.service_global_caps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES merchant_market_services(id) ON DELETE CASCADE UNIQUE,
  max_total_slots INTEGER NOT NULL,
  time_window_days INTEGER NOT NULL DEFAULT 30,
  enforce_per_category_max INTEGER DEFAULT NULL, -- e.g. 1 = max 1 per category
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.service_global_caps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read global caps"
  ON public.service_global_caps FOR SELECT
  USING (true);

-- Seed Spotlight: 4 total per month, max 1 per category
INSERT INTO service_global_caps (service_id, max_total_slots, time_window_days, enforce_per_category_max)
VALUES ('7552d9f2-5360-4141-9b86-d19ad04266b0', 4, 30, 1);

-- Search Ranking Booster: algorithmic soft-scarcity config
CREATE TABLE IF NOT EXISTS public.search_boost_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id UUID NOT NULL REFERENCES merchant_market_services(id) ON DELETE CASCADE UNIQUE,
  max_boosted_in_top_n INTEGER NOT NULL DEFAULT 2,
  top_n_results INTEGER NOT NULL DEFAULT 10,
  max_impression_share_pct NUMERIC(5,2) NOT NULL DEFAULT 25.00,
  impression_window_days INTEGER NOT NULL DEFAULT 7,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.search_boost_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read boost config"
  ON public.search_boost_config FOR SELECT
  USING (true);

-- Seed: 2 boosted in top 10, 25% impression cap per week
INSERT INTO search_boost_config (service_id, max_boosted_in_top_n, top_n_results, max_impression_share_pct, impression_window_days)
VALUES ('b7bf2a30-dccd-4a55-adf4-e4319171665b', 2, 10, 25.00, 7);
