-- Create sponsored placement analytics table for tracking impressions, clicks, and conversions
CREATE TABLE public.sponsored_placement_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL CHECK (event_type IN ('impression', 'click', 'conversion')),
  source_page TEXT NOT NULL CHECK (source_page IN ('discover', 'directory', 'map', 'search')),
  user_id UUID,
  session_id TEXT,
  search_query TEXT,
  position INTEGER,
  device_type TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for efficient querying
CREATE INDEX idx_sponsored_analytics_merchant_date ON public.sponsored_placement_analytics(merchant_id, created_at DESC);
CREATE INDEX idx_sponsored_analytics_event_type ON public.sponsored_placement_analytics(event_type);
CREATE INDEX idx_sponsored_analytics_source ON public.sponsored_placement_analytics(source_page);

-- Enable RLS
ALTER TABLE public.sponsored_placement_analytics ENABLE ROW LEVEL SECURITY;

-- Allow merchants to view their own analytics
CREATE POLICY "Merchants can view their own sponsored analytics"
ON public.sponsored_placement_analytics
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m 
    WHERE m.id = merchant_id AND m.user_id = auth.uid()
  )
);

-- Allow inserting analytics from edge functions (service role) and authenticated users
CREATE POLICY "Allow inserting sponsored analytics"
ON public.sponsored_placement_analytics
FOR INSERT
WITH CHECK (true);

-- Create sponsored placement daily aggregates for faster querying
CREATE TABLE public.sponsored_placement_daily_stats (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  merchant_id UUID NOT NULL REFERENCES public.merchants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  source_page TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  conversions INTEGER NOT NULL DEFAULT 0,
  unique_viewers INTEGER NOT NULL DEFAULT 0,
  avg_position NUMERIC(10,2),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(merchant_id, date, source_page)
);

-- Create indexes for daily stats
CREATE INDEX idx_sponsored_daily_merchant_date ON public.sponsored_placement_daily_stats(merchant_id, date DESC);

-- Enable RLS
ALTER TABLE public.sponsored_placement_daily_stats ENABLE ROW LEVEL SECURITY;

-- Allow merchants to view their own daily stats
CREATE POLICY "Merchants can view their own daily stats"
ON public.sponsored_placement_daily_stats
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.merchants m 
    WHERE m.id = merchant_id AND m.user_id = auth.uid()
  )
);

-- Allow edge functions to insert/update daily stats
CREATE POLICY "Allow upserting daily stats"
ON public.sponsored_placement_daily_stats
FOR ALL
USING (true)
WITH CHECK (true);

-- Create function to aggregate daily stats
CREATE OR REPLACE FUNCTION public.aggregate_sponsored_stats(target_date DATE DEFAULT CURRENT_DATE)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.sponsored_placement_daily_stats (
    merchant_id, date, source_page, impressions, clicks, conversions, unique_viewers, avg_position
  )
  SELECT 
    merchant_id,
    target_date,
    source_page,
    COUNT(*) FILTER (WHERE event_type = 'impression') as impressions,
    COUNT(*) FILTER (WHERE event_type = 'click') as clicks,
    COUNT(*) FILTER (WHERE event_type = 'conversion') as conversions,
    COUNT(DISTINCT COALESCE(user_id::text, session_id)) as unique_viewers,
    AVG(position) FILTER (WHERE position IS NOT NULL) as avg_position
  FROM public.sponsored_placement_analytics
  WHERE created_at::date = target_date
  GROUP BY merchant_id, source_page
  ON CONFLICT (merchant_id, date, source_page)
  DO UPDATE SET
    impressions = EXCLUDED.impressions,
    clicks = EXCLUDED.clicks,
    conversions = EXCLUDED.conversions,
    unique_viewers = EXCLUDED.unique_viewers,
    avg_position = EXCLUDED.avg_position,
    updated_at = now();
END;
$$;