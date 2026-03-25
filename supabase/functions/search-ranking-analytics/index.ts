import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { action, merchantId, ...params } = await req.json();

    // Verify merchant ownership
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, business_type, description, address')
      .eq('id', merchantId)
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found or access denied' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let result;
    switch (action) {
      case 'trackEvent':
        result = await trackEvent(supabase, merchantId, params);
        break;
      case 'getAnalytics':
        result = await getAnalytics(supabase, merchantId, merchant, params);
        break;
      case 'getKeywordInsights':
        result = await getKeywordInsights(supabase, merchantId, merchant, params);
        break;
      case 'getCompetitorBenchmark':
        result = await getCompetitorBenchmark(supabase, merchantId, merchant);
        break;
      case 'getAIRecommendations':
        result = await getAIRecommendations(supabase, merchantId, merchant, params);
        break;
      case 'getMonthlyReport':
        result = await getMonthlyReport(supabase, merchantId, merchant);
        break;
      case 'addKeyword':
        result = await addKeyword(supabase, merchantId, params);
        break;
      case 'removeKeyword':
        result = await removeKeyword(supabase, merchantId, params);
        break;
      default:
        return new Response(JSON.stringify({ error: 'Invalid action' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Search ranking analytics error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function trackEvent(supabase: any, merchantId: string, params: any) {
  const { eventType, searchTerm, position, sourcePage, userId, sessionId, deviceType, isBoosted, categoryMatch, localMatch } = params;
  
  const { error } = await supabase
    .from('search_ranking_analytics')
    .insert({
      merchant_id: merchantId,
      event_type: eventType,
      search_term: searchTerm,
      position,
      source_page: sourcePage,
      user_id: userId,
      session_id: sessionId,
      device_type: deviceType,
      is_boosted: isBoosted || false,
      category_match: categoryMatch || false,
      local_match: localMatch || false,
    });

  if (error) throw error;
  return { success: true };
}

async function getAnalytics(supabase: any, merchantId: string, merchant: any, params: any) {
  const { startDate, endDate } = params;
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  // Check if merchant has Search Ranking Booster service
  const { data: servicePurchase } = await supabase
    .from('merchant_service_purchases')
    .select(`
      *,
      service:merchant_market_services(name)
    `)
    .eq('merchant_id', merchantId)
    .eq('status', 'active')
    .gte('expires_at', new Date().toISOString());

  const hasBooster = servicePurchase?.some((p: any) => 
    p.service?.name === 'Search Ranking Booster'
  );

  // Get raw analytics
  const { data: rawAnalytics } = await supabase
    .from('search_ranking_analytics')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('created_at', start)
    .lte('created_at', end + 'T23:59:59');

  // Get daily stats
  const { data: dailyStats } = await supabase
    .from('search_ranking_daily_stats')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('date', start)
    .lte('date', end)
    .order('date', { ascending: true });

  // Calculate metrics
  const impressions = rawAnalytics?.filter((a: any) => a.event_type === 'impression').length || 0;
  const clicks = rawAnalytics?.filter((a: any) => a.event_type === 'click').length || 0;
  const conversions = rawAnalytics?.filter((a: any) => a.event_type === 'conversion').length || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  // Position analysis
  const positionsWithData = rawAnalytics?.filter((a: any) => a.position !== null) || [];
  const avgPosition = positionsWithData.length > 0 
    ? positionsWithData.reduce((sum: number, a: any) => sum + a.position, 0) / positionsWithData.length 
    : null;
  const bestPosition = positionsWithData.length > 0
    ? Math.min(...positionsWithData.map((a: any) => a.position))
    : null;

  // Category and local match analysis
  const categoryImpressions = rawAnalytics?.filter((a: any) => a.category_match && a.event_type === 'impression').length || 0;
  const localImpressions = rawAnalytics?.filter((a: any) => a.local_match && a.event_type === 'impression').length || 0;

  // Top search terms
  const termCounts: Record<string, { impressions: number; clicks: number }> = {};
  rawAnalytics?.forEach((a: any) => {
    if (a.search_term) {
      if (!termCounts[a.search_term]) {
        termCounts[a.search_term] = { impressions: 0, clicks: 0 };
      }
      if (a.event_type === 'impression') termCounts[a.search_term].impressions++;
      if (a.event_type === 'click') termCounts[a.search_term].clicks++;
    }
  });

  const topSearchTerms = Object.entries(termCounts)
    .map(([term, data]) => ({
      term,
      ...data,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0
    }))
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 10);

  // Calculate boost metrics
  const boostMultiplier = hasBooster ? calculateBoostMultiplier(merchant, topSearchTerms) : 1;
  const rankingScore = calculateRankingScore(merchant, topSearchTerms);
  const visibilityIncrease = hasBooster ? Math.round((boostMultiplier - 1) * 100) : 0;

  // Device breakdown
  const deviceBreakdown = {
    desktop: rawAnalytics?.filter((a: any) => a.device_type === 'desktop').length || 0,
    mobile: rawAnalytics?.filter((a: any) => a.device_type === 'mobile').length || 0,
    tablet: rawAnalytics?.filter((a: any) => a.device_type === 'tablet').length || 0,
  };

  // Source breakdown
  const sourceBreakdown = {
    discover: rawAnalytics?.filter((a: any) => a.source_page === 'discover' && a.event_type === 'impression').length || 0,
    directory: rawAnalytics?.filter((a: any) => a.source_page === 'directory' && a.event_type === 'impression').length || 0,
    map: rawAnalytics?.filter((a: any) => a.source_page === 'map' && a.event_type === 'impression').length || 0,
    search: rawAnalytics?.filter((a: any) => a.source_page === 'search' && a.event_type === 'impression').length || 0,
  };

  return {
    hasBooster,
    boostMultiplier,
    rankingScore,
    visibilityIncrease,
    metrics: {
      impressions,
      clicks,
      conversions,
      ctr: Math.round(ctr * 100) / 100,
      conversionRate: Math.round(conversionRate * 100) / 100,
      avgPosition: avgPosition ? Math.round(avgPosition * 10) / 10 : null,
      bestPosition,
      uniqueSearchers: new Set(rawAnalytics?.map((a: any) => a.user_id || a.session_id)).size,
    },
    categoryMetrics: {
      categoryImpressions,
      localImpressions,
      categoryMatchRate: impressions > 0 ? Math.round((categoryImpressions / impressions) * 100) : 0,
      localMatchRate: impressions > 0 ? Math.round((localImpressions / impressions) * 100) : 0,
    },
    topSearchTerms,
    dailyTrends: dailyStats || [],
    deviceBreakdown,
    sourceBreakdown,
  };
}

async function getKeywordInsights(supabase: any, merchantId: string, merchant: any, params: any) {
  const { startDate, endDate } = params;
  const start = startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const end = endDate || new Date().toISOString().split('T')[0];

  // Fetch merchant's saved search keywords
  const { data: merchantFull } = await supabase
    .from('merchants')
    .select('search_keywords')
    .eq('id', merchantId)
    .single();
  const savedKeywords: string[] = (merchantFull?.search_keywords || []).map((k: string) => k.toLowerCase());

  // Get search analytics
  const { data: searchAnalytics } = await supabase
    .from('merchant_search_analytics')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('date', start)
    .lte('date', end);

  const { data: rankingAnalytics } = await supabase
    .from('search_ranking_analytics')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('created_at', start)
    .lte('created_at', end + 'T23:59:59');

  // Combine and analyze keywords
  const keywordStats: Record<string, {
    views: number;
    clicks: number;
    conversions: number;
    avgPosition: number[];
    implemented: boolean;
  }> = {};

  searchAnalytics?.forEach((row: any) => {
    if (!keywordStats[row.search_term]) {
      keywordStats[row.search_term] = { views: 0, clicks: 0, conversions: 0, avgPosition: [], implemented: false };
    }
    keywordStats[row.search_term].views += row.views || 0;
    keywordStats[row.search_term].clicks += row.clicks || 0;
    keywordStats[row.search_term].conversions += row.conversions || 0;
  });

  rankingAnalytics?.forEach((row: any) => {
    if (row.search_term) {
      if (!keywordStats[row.search_term]) {
        keywordStats[row.search_term] = { views: 0, clicks: 0, conversions: 0, avgPosition: [], implemented: false };
      }
      if (row.event_type === 'impression') keywordStats[row.search_term].views++;
      if (row.event_type === 'click') keywordStats[row.search_term].clicks++;
      if (row.position) keywordStats[row.search_term].avgPosition.push(row.position);
    }
  });

  // Generate keyword recommendations
  const businessTypeKeywords = getBusinessTypeKeywords(merchant.business_type);
  const merchantDescription = (merchant.description || '').toLowerCase();
  const merchantName = merchant.business_name.toLowerCase();

  const keywordRecommendations = businessTypeKeywords.map(kw => {
    const stats = keywordStats[kw.term] || { views: 0, clicks: 0, conversions: 0, avgPosition: [] };
    const implemented = savedKeywords.includes(kw.term.toLowerCase()) ||
                        merchantDescription.includes(kw.term.toLowerCase()) || 
                        merchantName.includes(kw.term.toLowerCase()) ||
                        stats.views > 0;
    
    const avgPos = stats.avgPosition.length > 0
      ? stats.avgPosition.reduce((a, b) => a + b, 0) / stats.avgPosition.length
      : null;

    return {
      keyword: kw.term,
      relevance: kw.relevance,
      competition: kw.competition,
      searchVolume: kw.searchVolume,
      currentRank: avgPos ? Math.round(avgPos) : null,
      potentialRank: implemented ? Math.max(1, Math.round((avgPos || 10) * 0.5)) : Math.floor(Math.random() * 3) + 1,
      implemented,
      views: stats.views,
      clicks: stats.clicks,
      ctr: stats.views > 0 ? Math.round((stats.clicks / stats.views) * 100 * 10) / 10 : 0,
    };
  });

  // Actual performing keywords from data
  const performingKeywords = Object.entries(keywordStats)
    .map(([term, stats]) => ({
      keyword: term,
      views: stats.views,
      clicks: stats.clicks,
      ctr: stats.views > 0 ? Math.round((stats.clicks / stats.views) * 100 * 10) / 10 : 0,
      avgPosition: stats.avgPosition.length > 0
        ? Math.round(stats.avgPosition.reduce((a, b) => a + b, 0) / stats.avgPosition.length * 10) / 10
        : null,
    }))
    .filter(k => k.views > 0)
    .sort((a, b) => b.views - a.views)
    .slice(0, 15);

  return {
    recommendations: keywordRecommendations.sort((a, b) => b.relevance - a.relevance),
    performingKeywords,
    profileOptimizations: generateProfileOptimizations(merchant),
  };
}

async function getCompetitorBenchmark(supabase: any, merchantId: string, merchant: any) {
  // Get competitors in same business type
  const { data: competitors } = await supabase
    .from('merchants')
    .select('id, business_name')
    .eq('business_type', merchant.business_type)
    .neq('id', merchantId)
    .limit(10);

  const competitorIds = competitors?.map((c: any) => c.id) || [];
  
  // Get analytics for this merchant and competitors (last 30 days)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data: merchantStats } = await supabase
    .from('search_ranking_analytics')
    .select('*')
    .eq('merchant_id', merchantId)
    .gte('created_at', thirtyDaysAgo);

  const { data: competitorStats } = await supabase
    .from('search_ranking_analytics')
    .select('*')
    .in('merchant_id', competitorIds)
    .gte('created_at', thirtyDaysAgo);

  // Calculate merchant metrics
  const merchantImpressions = merchantStats?.filter((s: any) => s.event_type === 'impression').length || 0;
  const merchantClicks = merchantStats?.filter((s: any) => s.event_type === 'click').length || 0;
  const merchantPositions = merchantStats?.filter((s: any) => s.position !== null).map((s: any) => s.position) || [];
  const merchantAvgPosition = merchantPositions.length > 0
    ? merchantPositions.reduce((a: number, b: number) => a + b, 0) / merchantPositions.length
    : 10;

  // Calculate competitor averages
  const competitorMetrics: Record<string, { impressions: number; clicks: number; positions: number[] }> = {};
  competitorStats?.forEach((s: any) => {
    if (!competitorMetrics[s.merchant_id]) {
      competitorMetrics[s.merchant_id] = { impressions: 0, clicks: 0, positions: [] };
    }
    if (s.event_type === 'impression') competitorMetrics[s.merchant_id].impressions++;
    if (s.event_type === 'click') competitorMetrics[s.merchant_id].clicks++;
    if (s.position !== null) competitorMetrics[s.merchant_id].positions.push(s.position);
  });

  const competitorData = Object.entries(competitorMetrics).map(([id, data]) => {
    const avgPos = data.positions.length > 0
      ? data.positions.reduce((a, b) => a + b, 0) / data.positions.length
      : 10;
    return {
      id,
      name: competitors?.find((c: any) => c.id === id)?.business_name || 'Competitor',
      impressions: data.impressions,
      clicks: data.clicks,
      ctr: data.impressions > 0 ? (data.clicks / data.impressions) * 100 : 0,
      avgPosition: avgPos,
      rankingScore: calculateSimpleRankingScore(data.impressions, data.clicks, avgPos),
    };
  });

  const industryAvgImpressions = competitorData.length > 0
    ? competitorData.reduce((sum, c) => sum + c.impressions, 0) / competitorData.length
    : 0;
  const industryAvgClicks = competitorData.length > 0
    ? competitorData.reduce((sum, c) => sum + c.clicks, 0) / competitorData.length
    : 0;
  const industryAvgCtr = industryAvgImpressions > 0 ? (industryAvgClicks / industryAvgImpressions) * 100 : 0;
  const industryAvgPosition = competitorData.length > 0
    ? competitorData.reduce((sum, c) => sum + c.avgPosition, 0) / competitorData.length
    : 10;

  const merchantRankingScore = calculateSimpleRankingScore(merchantImpressions, merchantClicks, merchantAvgPosition);
  const allScores = [merchantRankingScore, ...competitorData.map(c => c.rankingScore)].sort((a, b) => b - a);
  const merchantRank = allScores.indexOf(merchantRankingScore) + 1;

  return {
    merchantMetrics: {
      impressions: merchantImpressions,
      clicks: merchantClicks,
      ctr: merchantImpressions > 0 ? Math.round((merchantClicks / merchantImpressions) * 100 * 10) / 10 : 0,
      avgPosition: Math.round(merchantAvgPosition * 10) / 10,
      rankingScore: merchantRankingScore,
    },
    industryAverages: {
      impressions: Math.round(industryAvgImpressions),
      clicks: Math.round(industryAvgClicks),
      ctr: Math.round(industryAvgCtr * 10) / 10,
      avgPosition: Math.round(industryAvgPosition * 10) / 10,
    },
    ranking: merchantRank,
    totalCompetitors: competitorData.length + 1,
    topCompetitors: competitorData.sort((a, b) => b.rankingScore - a.rankingScore).slice(0, 5),
    performanceScore: Math.round((merchantRankingScore / Math.max(...allScores, 1)) * 100),
  };
}

async function getAIRecommendations(supabase: any, merchantId: string, merchant: any, params: any) {
  const analytics = await getAnalytics(supabase, merchantId, merchant, params);
  const keywordInsights = await getKeywordInsights(supabase, merchantId, merchant, params);
  const benchmark = await getCompetitorBenchmark(supabase, merchantId, merchant);

  const recommendations: Array<{
    type: 'opportunity' | 'warning' | 'insight' | 'action';
    priority: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    impact: string;
  }> = [];

  // Keyword optimization recommendations
  const unimplementedHighRelevance = keywordInsights.recommendations
    .filter((k: any) => !k.implemented && k.relevance >= 80)
    .slice(0, 3);

  if (unimplementedHighRelevance.length > 0) {
    recommendations.push({
      type: 'opportunity',
      priority: 'high',
      title: 'Add High-Value Keywords',
      description: `Add these keywords to your profile: ${unimplementedHighRelevance.map((k: any) => k.keyword).join(', ')}`,
      impact: `Could improve visibility by ${unimplementedHighRelevance.length * 15}%`,
    });
  }

  // Position improvement opportunities
  if (analytics.metrics.avgPosition && analytics.metrics.avgPosition > 5) {
    recommendations.push({
      type: 'action',
      priority: 'high',
      title: 'Improve Search Position',
      description: `Your average position is ${analytics.metrics.avgPosition}. Optimize your profile description and add more relevant keywords to rank higher.`,
      impact: 'Moving to top 3 could increase clicks by 200%',
    });
  }

  // Category match optimization
  if (analytics.categoryMetrics.categoryMatchRate < 50) {
    recommendations.push({
      type: 'warning',
      priority: 'medium',
      title: 'Category Visibility Low',
      description: `Only ${analytics.categoryMetrics.categoryMatchRate}% of impressions come from category searches. Add more category-specific terms to your description.`,
      impact: 'Increase category visibility by 40%',
    });
  }

  // Local search optimization
  if (analytics.categoryMetrics.localMatchRate < 30 && merchant.address) {
    recommendations.push({
      type: 'opportunity',
      priority: 'medium',
      title: 'Boost Local Search Presence',
      description: 'Include location-specific terms in your description to appear in more local searches.',
      impact: 'Local searches convert 50% better',
    });
  }

  // CTR improvement
  if (analytics.metrics.ctr < 3 && analytics.metrics.impressions > 50) {
    recommendations.push({
      type: 'action',
      priority: 'high',
      title: 'Improve Click-Through Rate',
      description: `Your CTR is ${analytics.metrics.ctr}%. Consider updating your business description to be more compelling.`,
      impact: 'A 2% CTR improvement could double your clicks',
    });
  }

  // Competitor insights
  if (benchmark.ranking > 3) {
    recommendations.push({
      type: 'insight',
      priority: 'medium',
      title: 'Competitor Analysis',
      description: `You rank #${benchmark.ranking} out of ${benchmark.totalCompetitors} in your category. Top performers have ${Math.round(benchmark.industryAverages.impressions * 1.5)} impressions/month.`,
      impact: 'Reaching top 3 increases visibility significantly',
    });
  }

  // Profile completeness
  const incompleteOptimizations = keywordInsights.profileOptimizations.filter((o: any) => o.status !== 'completed');
  if (incompleteOptimizations.length > 2) {
    recommendations.push({
      type: 'action',
      priority: 'medium',
      title: 'Complete Profile Optimization',
      description: `${incompleteOptimizations.length} profile optimizations pending. Complete them to maximize search ranking.`,
      impact: 'Complete profiles rank 30% higher',
    });
  }

  // Calculate health score
  const healthScore = calculateHealthScore(analytics, keywordInsights, benchmark);

  // Predictions
  const predictions = {
    nextMonthImpressions: Math.round(analytics.metrics.impressions * (1 + (analytics.hasBooster ? 0.5 : 0.1))),
    nextMonthClicks: Math.round(analytics.metrics.clicks * (1 + (analytics.hasBooster ? 0.6 : 0.1))),
    potentialRankImprovement: analytics.hasBooster ? Math.max(1, Math.round((analytics.metrics.avgPosition || 10) * 0.6)) : null,
  };

  return {
    healthScore,
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    predictions,
    summary: generateAISummary(analytics, keywordInsights, benchmark, healthScore),
  };
}

async function getMonthlyReport(supabase: any, merchantId: string, merchant: any) {
  const now = new Date();
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().split('T')[0];
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().split('T')[0];

  const thisMonthAnalytics = await getAnalytics(supabase, merchantId, merchant, { startDate: thisMonthStart });
  const lastMonthAnalytics = await getAnalytics(supabase, merchantId, merchant, { startDate: lastMonthStart, endDate: lastMonthEnd });
  const keywordInsights = await getKeywordInsights(supabase, merchantId, merchant, { startDate: thisMonthStart });
  const benchmark = await getCompetitorBenchmark(supabase, merchantId, merchant);

  const changes = {
    impressions: calculateChange(lastMonthAnalytics.metrics.impressions, thisMonthAnalytics.metrics.impressions),
    clicks: calculateChange(lastMonthAnalytics.metrics.clicks, thisMonthAnalytics.metrics.clicks),
    ctr: calculateChange(lastMonthAnalytics.metrics.ctr, thisMonthAnalytics.metrics.ctr),
    avgPosition: lastMonthAnalytics.metrics.avgPosition && thisMonthAnalytics.metrics.avgPosition
      ? Math.round((lastMonthAnalytics.metrics.avgPosition - thisMonthAnalytics.metrics.avgPosition) * 10) / 10
      : 0,
  };

  return {
    period: {
      start: thisMonthStart,
      end: now.toISOString().split('T')[0],
    },
    currentMetrics: thisMonthAnalytics.metrics,
    previousMetrics: lastMonthAnalytics.metrics,
    changes,
    topKeywords: keywordInsights.performingKeywords.slice(0, 5),
    competitorRanking: benchmark.ranking,
    totalCompetitors: benchmark.totalCompetitors,
    rankingScore: benchmark.merchantMetrics.rankingScore,
    highlights: generateMonthlyHighlights(thisMonthAnalytics, lastMonthAnalytics, changes, benchmark),
  };
}

// Helper functions
function calculateBoostMultiplier(merchant: any, keywords: any[]): number {
  let multiplier = 1.5; // Base boost
  
  // Add based on profile completeness
  if (merchant.description && merchant.description.length > 100) multiplier += 0.3;
  if (merchant.address) multiplier += 0.2;
  
  // Add based on keyword performance
  const implementedHighValue = keywords.filter(k => k.implemented && k.relevance > 70).length;
  multiplier += Math.min(0.5, implementedHighValue * 0.1);
  
  return Math.min(3, Math.round(multiplier * 10) / 10);
}

function calculateRankingScore(merchant: any, keywords: any[]): number {
  let score = 50;
  
  const descLength = merchant.description?.length || 0;
  score += Math.min(20, descLength / 10);
  
  if (merchant.address && merchant.address.length > 20) score += 10;
  
  const implementedKeywords = keywords.filter((k: any) => k.implemented).length;
  score += Math.min(20, (implementedKeywords / Math.max(keywords.length, 1)) * 20);
  
  return Math.min(100, Math.round(score));
}

function calculateSimpleRankingScore(impressions: number, clicks: number, avgPosition: number): number {
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const positionScore = Math.max(0, 100 - (avgPosition * 10));
  const volumeScore = Math.min(50, impressions / 2);
  const ctrScore = Math.min(30, ctr * 3);
  
  return Math.round((positionScore * 0.4 + volumeScore * 0.3 + ctrScore * 0.3));
}

function calculateHealthScore(analytics: any, keywords: any, benchmark: any): number {
  let score = 0;
  
  // CTR score (max 25)
  score += Math.min(25, analytics.metrics.ctr * 5);
  
  // Position score (max 25)
  if (analytics.metrics.avgPosition) {
    score += Math.max(0, 25 - (analytics.metrics.avgPosition * 2.5));
  }
  
  // Keyword optimization (max 25)
  const implementedRate = keywords.recommendations.filter((k: any) => k.implemented).length / keywords.recommendations.length;
  score += implementedRate * 25;
  
  // Competitive ranking (max 25)
  const rankPercentile = 1 - ((benchmark.ranking - 1) / benchmark.totalCompetitors);
  score += rankPercentile * 25;
  
  return Math.round(score);
}

function generateAISummary(analytics: any, keywords: any, benchmark: any, healthScore: number): string {
  const parts = [];
  
  if (healthScore >= 80) {
    parts.push("Excellent search performance!");
  } else if (healthScore >= 60) {
    parts.push("Good search visibility with room for improvement.");
  } else if (healthScore >= 40) {
    parts.push("Moderate search performance. Focus on the recommendations below.");
  } else {
    parts.push("Search visibility needs attention. Implementing the recommendations will significantly improve your ranking.");
  }
  
  parts.push(`You rank #${benchmark.ranking} among ${benchmark.totalCompetitors} competitors in your category.`);
  
  const unimplemented = keywords.recommendations.filter((k: any) => !k.implemented && k.relevance >= 80).length;
  if (unimplemented > 0) {
    parts.push(`${unimplemented} high-value keywords available to implement.`);
  }
  
  return parts.join(' ');
}

function generateMonthlyHighlights(current: any, previous: any, changes: any, benchmark: any): string[] {
  const highlights = [];
  
  if (changes.impressions > 20) {
    highlights.push(`Impressions up ${changes.impressions}% from last month`);
  }
  if (changes.clicks > 20) {
    highlights.push(`Clicks increased by ${changes.clicks}%`);
  }
  if (changes.avgPosition > 0) {
    highlights.push(`Search position improved by ${changes.avgPosition} places`);
  }
  if (benchmark.ranking <= 3) {
    highlights.push(`Ranked #${benchmark.ranking} in your category`);
  }
  if (current.categoryMetrics.categoryMatchRate > 50) {
    highlights.push(`${current.categoryMetrics.categoryMatchRate}% category match rate`);
  }
  
  if (highlights.length === 0) {
    highlights.push('Maintain consistency to build momentum');
  }
  
  return highlights;
}

function calculateChange(previous: number, current: number): number {
  if (previous === 0) return current > 0 ? 100 : 0;
  return Math.round(((current - previous) / previous) * 100);
}

function getBusinessTypeKeywords(businessType: string): Array<{
  term: string;
  relevance: number;
  competition: 'low' | 'medium' | 'high';
  searchVolume: 'low' | 'medium' | 'high';
}> {
  const keywordsByType: Record<string, any[]> = {
    vet: [
      { term: 'veterinarian near me', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'pet doctor', relevance: 90, competition: 'medium', searchVolume: 'high' },
      { term: 'animal hospital', relevance: 85, competition: 'high', searchVolume: 'medium' },
      { term: 'emergency vet', relevance: 88, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet vaccinations', relevance: 82, competition: 'low', searchVolume: 'medium' },
      { term: 'pet checkup', relevance: 80, competition: 'low', searchVolume: 'medium' },
      { term: 'dog vet', relevance: 78, competition: 'medium', searchVolume: 'high' },
      { term: 'cat vet', relevance: 76, competition: 'medium', searchVolume: 'medium' },
      { term: 'affordable vet', relevance: 85, competition: 'medium', searchVolume: 'high' },
    ],
    groomer: [
      { term: 'dog grooming', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'pet groomer near me', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'cat grooming', relevance: 85, competition: 'low', searchVolume: 'medium' },
      { term: 'dog haircut', relevance: 88, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet spa', relevance: 75, competition: 'low', searchVolume: 'medium' },
      { term: 'mobile grooming', relevance: 72, competition: 'low', searchVolume: 'low' },
      { term: 'puppy grooming', relevance: 82, competition: 'medium', searchVolume: 'medium' },
    ],
    pet_store: [
      { term: 'pet store near me', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'pet supplies', relevance: 90, competition: 'high', searchVolume: 'high' },
      { term: 'dog food', relevance: 88, competition: 'high', searchVolume: 'high' },
      { term: 'cat food', relevance: 85, competition: 'medium', searchVolume: 'high' },
      { term: 'pet toys', relevance: 82, competition: 'medium', searchVolume: 'medium' },
      { term: 'pet accessories', relevance: 75, competition: 'low', searchVolume: 'medium' },
    ],
    trainer: [
      { term: 'dog training', relevance: 95, competition: 'high', searchVolume: 'high' },
      { term: 'puppy training', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'obedience training', relevance: 88, competition: 'medium', searchVolume: 'medium' },
      { term: 'dog trainer near me', relevance: 90, competition: 'medium', searchVolume: 'high' },
      { term: 'behavior training', relevance: 82, competition: 'low', searchVolume: 'medium' },
    ],
    sitter: [
      { term: 'pet sitting', relevance: 95, competition: 'medium', searchVolume: 'high' },
      { term: 'dog sitter near me', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'pet boarding', relevance: 85, competition: 'high', searchVolume: 'high' },
      { term: 'overnight pet care', relevance: 80, competition: 'low', searchVolume: 'medium' },
    ],
    walker: [
      { term: 'dog walking', relevance: 95, competition: 'medium', searchVolume: 'high' },
      { term: 'dog walker near me', relevance: 92, competition: 'medium', searchVolume: 'high' },
      { term: 'pet walking service', relevance: 85, competition: 'low', searchVolume: 'medium' },
    ],
  };

  return keywordsByType[businessType.toLowerCase()] || keywordsByType.pet_store;
}

function generateProfileOptimizations(merchant: any): Array<{
  category: string;
  title: string;
  description: string;
  status: 'completed' | 'pending' | 'recommended';
  impact: 'high' | 'medium' | 'low';
}> {
  const optimizations = [];

  const descriptionLength = merchant.description?.length || 0;
  if (descriptionLength > 100) {
    optimizations.push({
      category: 'content',
      title: 'Detailed Description',
      description: 'Your business description is comprehensive.',
      status: 'completed' as const,
      impact: 'high' as const,
    });
  } else {
    optimizations.push({
      category: 'content',
      title: 'Expand Description',
      description: 'Add more details about your services (100+ characters recommended).',
      status: descriptionLength > 50 ? 'pending' as const : 'recommended' as const,
      impact: 'high' as const,
    });
  }

  if (merchant.address && merchant.address.length > 20) {
    optimizations.push({
      category: 'location',
      title: 'Complete Address',
      description: 'Your address helps with local search results.',
      status: 'completed' as const,
      impact: 'high' as const,
    });
  } else {
    optimizations.push({
      category: 'location',
      title: 'Add Complete Address',
      description: 'Include full address for local search visibility.',
      status: 'recommended' as const,
      impact: 'high' as const,
    });
  }

  optimizations.push({
    category: 'engagement',
    title: 'Respond to Reviews',
    description: 'Active review responses improve ranking.',
    status: 'pending' as const,
    impact: 'medium' as const,
  });

  optimizations.push({
    category: 'media',
    title: 'Add Business Logo',
    description: 'Profiles with logos get 40% more clicks.',
    status: 'pending' as const,
    impact: 'medium' as const,
  });

  return optimizations;
}

async function addKeyword(supabase: any, merchantId: string, params: any) {
  const { keyword } = params;
  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Keyword is required');
  }

  // Get current keywords
  const { data: merchant, error: fetchError } = await supabase
    .from('merchants')
    .select('search_keywords')
    .eq('id', merchantId)
    .single();

  if (fetchError) throw fetchError;

  const currentKeywords: string[] = merchant.search_keywords || [];
  
  // Check if already exists
  if (currentKeywords.includes(keyword.toLowerCase().trim())) {
    return { success: true, message: 'Keyword already added', keywords: currentKeywords };
  }

  const updatedKeywords = [...currentKeywords, keyword.toLowerCase().trim()];

  const { error: updateError } = await supabase
    .from('merchants')
    .update({ search_keywords: updatedKeywords })
    .eq('id', merchantId);

  if (updateError) throw updateError;

  return { success: true, message: 'Keyword added successfully', keywords: updatedKeywords };
}

async function removeKeyword(supabase: any, merchantId: string, params: any) {
  const { keyword } = params;
  if (!keyword || typeof keyword !== 'string') {
    throw new Error('Keyword is required');
  }

  const { data: merchant, error: fetchError } = await supabase
    .from('merchants')
    .select('search_keywords')
    .eq('id', merchantId)
    .single();

  if (fetchError) throw fetchError;

  const currentKeywords: string[] = merchant.search_keywords || [];
  const updatedKeywords = currentKeywords.filter(k => k !== keyword.toLowerCase().trim());

  const { error: updateError } = await supabase
    .from('merchants')
    .update({ search_keywords: updatedKeywords })
    .eq('id', merchantId);

  if (updateError) throw updateError;

  return { success: true, message: 'Keyword removed successfully', keywords: updatedKeywords };
}
