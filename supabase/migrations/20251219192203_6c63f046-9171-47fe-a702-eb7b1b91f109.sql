-- Create search ranking analytics table for event tracking
CREATE TABLE public.search_ranking_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL, -- 'impression', 'click', 'conversion', 'search_appear'
  search_term TEXT,
  position INTEGER, -- Position in search results
  source_page TEXT NOT NULL, -- 'discover', 'directory', 'map', 'search'
  user_id UUID,
  session_id TEXT,
  device_type TEXT,
  is_boosted BOOLEAN DEFAULT false,
  category_match BOOLEAN DEFAULT false, -- Did search match merchant category
  local_match BOOLEAN DEFAULT false, -- Was this a local search match
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create daily aggregated stats for search ranking
CREATE TABLE public.search_ranking_daily_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  avg_position NUMERIC,
  best_position INTEGER,
  unique_searchers INTEGER NOT NULL DEFAULT 0,
  category_impressions INTEGER NOT NULL DEFAULT 0,
  local_impressions INTEGER NOT NULL DEFAULT 0,
  top_search_terms JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, date)
);

-- Enable RLS
ALTER TABLE public.search_ranking_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.search_ranking_daily_stats ENABLE ROW LEVEL SECURITY;

-- RLS policies for search_ranking_analytics
CREATE POLICY "Allow inserting search ranking analytics"
  ON public.search_ranking_analytics
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Merchants can view their own search analytics"
  ON public.search_ranking_analytics
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM merchants m
    WHERE m.id = search_ranking_analytics.merchant_id
    AND m.user_id = auth.uid()
  ));

-- RLS policies for search_ranking_daily_stats
CREATE POLICY "Allow upserting search ranking daily stats"
  ON public.search_ranking_daily_stats
  FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Merchants can view their own daily stats"
  ON public.search_ranking_daily_stats
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM merchants m
    WHERE m.id = search_ranking_daily_stats.merchant_id
    AND m.user_id = auth.uid()
  ));

-- Create indexes for performance
CREATE INDEX idx_search_ranking_analytics_merchant ON public.search_ranking_analytics(merchant_id);
CREATE INDEX idx_search_ranking_analytics_created ON public.search_ranking_analytics(created_at);
CREATE INDEX idx_search_ranking_analytics_search_term ON public.search_ranking_analytics(search_term);
CREATE INDEX idx_search_ranking_daily_stats_merchant_date ON public.search_ranking_daily_stats(merchant_id, date);

-- Function to aggregate daily search ranking stats
CREATE OR REPLACE FUNCTION public.aggregate_search_ranking_stats(target_date date DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.search_ranking_daily_stats (
    merchant_id, date, impressions, clicks, conversions, avg_position, best_position,
    unique_searchers, category_impressions, local_impressions, top_search_terms
  )
  SELECT 
    merchant_id,
    target_date,
    COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
    COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
    COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions,
    AVG(position) FILTER (WHERE position IS NOT NULL) as avg_position,
    MIN(position) FILTER (WHERE position IS NOT NULL) as best_position,
    COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_searchers,
    COUNT(*) FILTER (WHERE category_match = true AND event_type = 'impression') as category_impressions,
    COUNT(*) FILTER (WHERE local_match = true AND event_type = 'impression') as local_impressions,
    (
      SELECT jsonb_agg(term_data)
      FROM (
        SELECT jsonb_build_object('term', search_term, 'count', COUNT(*)) as term_data
        FROM public.search_ranking_analytics sra2
        WHERE sra2.merchant_id = search_ranking_analytics.merchant_id
        AND sra2.created_at::date = target_date
        AND sra2.search_term IS NOT NULL
        GROUP BY search_term
        ORDER BY COUNT(*) DESC
        LIMIT 10
      ) top_terms
    ) as top_search_terms
  FROM public.search_ranking_analytics
  WHERE created_at::date = target_date
  GROUP BY merchant_id
  ON CONFLICT (merchant_id, date)
  DO UPDATE SET
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    conversions = EXCLUDED.conversions,
    avg_position = EXCLUDED.avg_position,
    best_position = EXCLUDED.best_position,
    unique_searchers = EXCLUDED.unique_searchers,
    category_impressions = EXCLUDED.category_impressions,
    local_impressions = EXCLUDED.local_impressions,
    top_search_terms = EXCLUDED.top_search_terms,
    updated_at = now();
END;
$$;