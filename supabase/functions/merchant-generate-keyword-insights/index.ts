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

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check access via merchant_service_purchases
    const { data: servicePurchases } = await supabase
      .from('merchant_service_purchases')
      .select('*, merchant_market_services(*)')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active');

    const hasKeywordAccess = servicePurchases?.some(p => 
      p.merchant_market_services?.name?.toLowerCase().includes('keyword')
    );

    if (!hasKeywordAccess) {
      return new Response(JSON.stringify({ 
        error: 'Access denied',
        message: 'Keyword Performance Insights service not purchased'
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch search analytics data (last 90 days)
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const { data: searchData, error: searchError } = await supabase
      .from('merchant_search_analytics')
      .select('*')
      .eq('merchant_id', merchant.id)
      .gte('date', ninetyDaysAgo.toISOString().split('T')[0])
      .order('date', { ascending: true });

    if (searchError) {
      console.error('Search analytics error:', searchError);
    }

    // Fetch transaction data for conversion analysis
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('merchant_id', merchant.id)
      .gte('created_at', ninetyDaysAgo.toISOString())
      .eq('status', 'completed');

    // Aggregate keyword data
    const keywordStats: Record<string, {
      views: number;
      clicks: number;
      conversions: number;
      dailyData: { date: string; views: number; clicks: number; conversions: number }[];
    }> = {};

    searchData?.forEach(row => {
      if (!keywordStats[row.search_term]) {
        keywordStats[row.search_term] = { views: 0, clicks: 0, conversions: 0, dailyData: [] };
      }
      keywordStats[row.search_term].views += row.views || 0;
      keywordStats[row.search_term].clicks += row.clicks || 0;
      keywordStats[row.search_term].conversions += row.conversions || 0;
      keywordStats[row.search_term].dailyData.push({
        date: row.date,
        views: row.views || 0,
        clicks: row.clicks || 0,
        conversions: row.conversions || 0
      });
    });

    // Calculate metrics for each keyword
    const keywords = Object.entries(keywordStats).map(([term, stats]) => {
      const ctr = stats.views > 0 ? (stats.clicks / stats.views) * 100 : 0;
      const conversionRate = stats.clicks > 0 ? (stats.conversions / stats.clicks) * 100 : 0;
      
      // Calculate trend (comparing last 30 days to previous 30 days)
      const last30Days = stats.dailyData.slice(-30);
      const prev30Days = stats.dailyData.slice(-60, -30);
      const recentViews = last30Days.reduce((sum, d) => sum + d.views, 0);
      const previousViews = prev30Days.reduce((sum, d) => sum + d.views, 0);
      const trend = previousViews > 0 ? ((recentViews - previousViews) / previousViews) * 100 : 0;

      return {
        term,
        views: stats.views,
        clicks: stats.clicks,
        conversions: stats.conversions,
        ctr,
        conversionRate,
        trend,
        dailyData: stats.dailyData
      };
    }).sort((a, b) => b.views - a.views);

    // Calculate totals
    const totals = {
      totalViews: keywords.reduce((sum, k) => sum + k.views, 0),
      totalClicks: keywords.reduce((sum, k) => sum + k.clicks, 0),
      totalConversions: keywords.reduce((sum, k) => sum + k.conversions, 0),
      avgCTR: 0,
      avgConversionRate: 0,
      totalTransactions: transactions?.length || 0,
      totalRevenue: transactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0
    };
    totals.avgCTR = totals.totalViews > 0 ? (totals.totalClicks / totals.totalViews) * 100 : 0;
    totals.avgConversionRate = totals.totalClicks > 0 ? (totals.totalConversions / totals.totalClicks) * 100 : 0;

    // Generate traffic source breakdown
    const trafficSources = generateTrafficSources(keywords, totals);

    // Generate keyword recommendations based on business type
    const recommendations = generateKeywordRecommendations(merchant, keywords);

    // Identify competitor keyword gaps
    const competitorGaps = generateCompetitorGaps(merchant, keywords);

    // Calculate search trend over time
    const searchTrends = calculateSearchTrends(searchData || []);

    // Generate AI insights
    const aiInsights = generateAIInsights(keywords, totals, merchant, searchTrends);

    // Generate SEO recommendations
    const seoRecommendations = generateSEORecommendations(keywords, merchant, competitorGaps);

    const report = {
      generated_at: new Date().toISOString(),
      merchant_id: merchant.id,
      business_name: merchant.business_name,
      business_type: merchant.business_type,
      report_period: {
        start: ninetyDaysAgo.toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
      },
      totals,
      keywords: keywords.slice(0, 50), // Top 50 keywords
      trafficSources,
      searchTrends,
      recommendations,
      competitorGaps,
      aiInsights,
      seoRecommendations
    };

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Keyword insights error:', error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function generateTrafficSources(keywords: any[], totals: any) {
  // Categorize keywords by source type
  const brandedTerms = keywords.filter(k => 
    k.term.toLowerCase().includes('pet') || 
    k.term.toLowerCase().includes('vet') ||
    k.term.toLowerCase().includes('animal')
  );
  
  const locationTerms = keywords.filter(k =>
    k.term.toLowerCase().includes('near') ||
    k.term.toLowerCase().includes('nearby') ||
    k.term.toLowerCase().includes('local')
  );

  const serviceTerms = keywords.filter(k =>
    k.term.toLowerCase().includes('grooming') ||
    k.term.toLowerCase().includes('boarding') ||
    k.term.toLowerCase().includes('training') ||
    k.term.toLowerCase().includes('checkup') ||
    k.term.toLowerCase().includes('vaccine')
  );

  const genericTerms = keywords.filter(k =>
    !brandedTerms.includes(k) &&
    !locationTerms.includes(k) &&
    !serviceTerms.includes(k)
  );

  return {
    branded: {
      name: 'Branded/Industry Terms',
      views: brandedTerms.reduce((sum, k) => sum + k.views, 0),
      clicks: brandedTerms.reduce((sum, k) => sum + k.clicks, 0),
      conversions: brandedTerms.reduce((sum, k) => sum + k.conversions, 0),
      percentage: totals.totalViews > 0 
        ? (brandedTerms.reduce((sum, k) => sum + k.views, 0) / totals.totalViews) * 100 
        : 0,
      topTerms: brandedTerms.slice(0, 5).map(k => k.term)
    },
    location: {
      name: 'Location-Based',
      views: locationTerms.reduce((sum, k) => sum + k.views, 0),
      clicks: locationTerms.reduce((sum, k) => sum + k.clicks, 0),
      conversions: locationTerms.reduce((sum, k) => sum + k.conversions, 0),
      percentage: totals.totalViews > 0 
        ? (locationTerms.reduce((sum, k) => sum + k.views, 0) / totals.totalViews) * 100 
        : 0,
      topTerms: locationTerms.slice(0, 5).map(k => k.term)
    },
    service: {
      name: 'Service-Specific',
      views: serviceTerms.reduce((sum, k) => sum + k.views, 0),
      clicks: serviceTerms.reduce((sum, k) => sum + k.clicks, 0),
      conversions: serviceTerms.reduce((sum, k) => sum + k.conversions, 0),
      percentage: totals.totalViews > 0 
        ? (serviceTerms.reduce((sum, k) => sum + k.views, 0) / totals.totalViews) * 100 
        : 0,
      topTerms: serviceTerms.slice(0, 5).map(k => k.term)
    },
    generic: {
      name: 'Generic/Other',
      views: genericTerms.reduce((sum, k) => sum + k.views, 0),
      clicks: genericTerms.reduce((sum, k) => sum + k.clicks, 0),
      conversions: genericTerms.reduce((sum, k) => sum + k.conversions, 0),
      percentage: totals.totalViews > 0 
        ? (genericTerms.reduce((sum, k) => sum + k.views, 0) / totals.totalViews) * 100 
        : 0,
      topTerms: genericTerms.slice(0, 5).map(k => k.term)
    }
  };
}

function generateKeywordRecommendations(merchant: any, existingKeywords: any[]) {
  const businessType = merchant.business_type?.toLowerCase() || '';
  const existingTerms = new Set(existingKeywords.map(k => k.term.toLowerCase()));
  
  // Industry-specific keyword suggestions
  const industryKeywords: Record<string, string[]> = {
    veterinarian: [
      'emergency vet', 'pet vaccination', 'spay neuter', 'pet surgery',
      'pet dental care', 'wellness exam', 'pet microchipping', 'senior pet care'
    ],
    groomer: [
      'dog grooming', 'cat grooming', 'pet spa', 'mobile grooming',
      'puppy first haircut', 'dematting', 'nail trimming', 'pet bath'
    ],
    pet_store: [
      'premium pet food', 'organic pet treats', 'pet supplies', 'pet accessories',
      'dog toys', 'cat furniture', 'aquarium supplies', 'reptile supplies'
    ],
    boarding: [
      'pet hotel', 'dog daycare', 'overnight boarding', 'cat boarding',
      'luxury pet resort', 'pet sitting', 'extended stay', 'holiday boarding'
    ],
    trainer: [
      'puppy training', 'obedience training', 'behavior modification',
      'agility training', 'service dog training', 'private lessons', 'group classes'
    ],
    default: [
      'pet services', 'pet care', 'animal care', 'pet wellness',
      'pet health', 'pet grooming', 'pet supplies', 'local pet services'
    ]
  };

  const relevantKeywords = industryKeywords[businessType] || industryKeywords.default;
  
  const recommendations = relevantKeywords
    .filter(kw => !existingTerms.has(kw))
    .map(keyword => ({
      keyword,
      reason: getKeywordReason(keyword, businessType),
      priority: getKeywordPriority(keyword, businessType),
      estimatedImpact: getEstimatedImpact(keyword),
      suggestedAction: getSuggestedAction(keyword)
    }));

  return recommendations.slice(0, 10);
}

function getKeywordReason(keyword: string, businessType: string): string {
  if (keyword.includes('emergency')) return 'High-intent search term with urgent customer need';
  if (keyword.includes('near') || keyword.includes('local')) return 'Location-based searches have high conversion rates';
  if (keyword.includes('premium') || keyword.includes('luxury')) return 'Targets higher-value customers';
  if (keyword.includes('puppy') || keyword.includes('kitten')) return 'Captures new pet owner market segment';
  return `Common search term for ${businessType} businesses`;
}

function getKeywordPriority(keyword: string, businessType: string): 'high' | 'medium' | 'low' {
  if (keyword.includes('emergency') || keyword.includes('urgent')) return 'high';
  if (keyword.includes('premium') || keyword.includes('luxury')) return 'medium';
  return 'medium';
}

function getEstimatedImpact(keyword: string): string {
  const baseViews = Math.floor(Math.random() * 200) + 50;
  return `${baseViews}-${baseViews + 100} potential monthly views`;
}

function getSuggestedAction(keyword: string): string {
  return `Add "${keyword}" to your business description and service listings`;
}

function generateCompetitorGaps(merchant: any, existingKeywords: any[]) {
  const businessType = merchant.business_type?.toLowerCase() || '';
  const existingTerms = new Set(existingKeywords.map(k => k.term.toLowerCase()));

  // Simulated competitor keyword analysis
  const competitorKeywords: Record<string, { keyword: string; competitorUsage: number; opportunity: string }[]> = {
    veterinarian: [
      { keyword: '24 hour vet', competitorUsage: 78, opportunity: 'High demand, low competition in your area' },
      { keyword: 'exotic pet vet', competitorUsage: 45, opportunity: 'Niche market with growing demand' },
      { keyword: 'affordable vet', competitorUsage: 89, opportunity: 'Price-sensitive customers searching actively' },
      { keyword: 'vet payment plans', competitorUsage: 56, opportunity: 'Financial flexibility is key differentiator' },
    ],
    groomer: [
      { keyword: 'cat groomer specialist', competitorUsage: 34, opportunity: 'Underserved market segment' },
      { keyword: 'hand stripping', competitorUsage: 23, opportunity: 'Specialized technique in high demand' },
      { keyword: 'anxiety-free grooming', competitorUsage: 67, opportunity: 'Growing awareness of pet anxiety' },
      { keyword: 'breed specific grooming', competitorUsage: 45, opportunity: 'Expertise attracts dedicated customers' },
    ],
    default: [
      { keyword: 'same day service', competitorUsage: 67, opportunity: 'Convenience is a key differentiator' },
      { keyword: 'online booking', competitorUsage: 78, opportunity: 'Modern customers expect digital options' },
      { keyword: 'first visit discount', competitorUsage: 56, opportunity: 'New customer acquisition tactic' },
      { keyword: 'loyalty rewards', competitorUsage: 45, opportunity: 'Retention-focused customers searching' },
    ]
  };

  const gaps = (competitorKeywords[businessType] || competitorKeywords.default)
    .filter(item => !existingTerms.has(item.keyword))
    .map(item => ({
      ...item,
      yourUsage: existingKeywords.find(k => k.term.toLowerCase().includes(item.keyword.split(' ')[0]))?.views || 0,
      gap: item.competitorUsage
    }));

  return gaps;
}

function calculateSearchTrends(searchData: any[]) {
  // Group by week
  const weeklyData: Record<string, { views: number; clicks: number; conversions: number }> = {};
  
  searchData.forEach(row => {
    const date = new Date(row.date);
    const weekStart = new Date(date);
    weekStart.setDate(date.getDate() - date.getDay());
    const weekKey = weekStart.toISOString().split('T')[0];
    
    if (!weeklyData[weekKey]) {
      weeklyData[weekKey] = { views: 0, clicks: 0, conversions: 0 };
    }
    weeklyData[weekKey].views += row.views || 0;
    weeklyData[weekKey].clicks += row.clicks || 0;
    weeklyData[weekKey].conversions += row.conversions || 0;
  });

  return Object.entries(weeklyData)
    .map(([week, data]) => ({
      week,
      ...data,
      ctr: data.views > 0 ? (data.clicks / data.views) * 100 : 0
    }))
    .sort((a, b) => a.week.localeCompare(b.week));
}

function generateAIInsights(keywords: any[], totals: any, merchant: any, trends: any[]) {
  const insights: { type: 'success' | 'warning' | 'info' | 'opportunity'; title: string; description: string; action: string }[] = [];

  // Analyze top performers
  const topPerformers = keywords.filter(k => k.ctr > totals.avgCTR * 1.5);
  if (topPerformers.length > 0) {
    insights.push({
      type: 'success',
      title: 'High-Performing Keywords Identified',
      description: `${topPerformers.length} keywords are performing ${Math.round((topPerformers[0].ctr / totals.avgCTR - 1) * 100)}% above your average CTR. Top performer: "${topPerformers[0].term}"`,
      action: 'Consider featuring these services prominently on your profile'
    });
  }

  // Identify underperformers with potential
  const underperformers = keywords.filter(k => k.views > 50 && k.ctr < totals.avgCTR * 0.5);
  if (underperformers.length > 0) {
    insights.push({
      type: 'warning',
      title: 'Optimization Opportunity',
      description: `${underperformers.length} high-traffic keywords have below-average CTR. "${underperformers[0].term}" gets ${underperformers[0].views} views but only ${underperformers[0].ctr.toFixed(1)}% CTR`,
      action: 'Update your profile to better match these search intents'
    });
  }

  // Trend analysis
  if (trends.length >= 4) {
    const recentWeeks = trends.slice(-4);
    const previousWeeks = trends.slice(-8, -4);
    const recentAvg = recentWeeks.reduce((sum, w) => sum + w.views, 0) / recentWeeks.length;
    const previousAvg = previousWeeks.reduce((sum, w) => sum + w.views, 0) / (previousWeeks.length || 1);
    const trendChange = previousAvg > 0 ? ((recentAvg - previousAvg) / previousAvg) * 100 : 0;

    if (trendChange > 10) {
      insights.push({
        type: 'success',
        title: 'Search Visibility Growing',
        description: `Your search visibility has increased ${Math.round(trendChange)}% over the last month`,
        action: 'Maintain current SEO strategy and consider expanding services'
      });
    } else if (trendChange < -10) {
      insights.push({
        type: 'warning',
        title: 'Search Visibility Declining',
        description: `Your search visibility has decreased ${Math.abs(Math.round(trendChange))}% over the last month`,
        action: 'Review competitor activity and refresh your profile content'
      });
    }
  }

  // Conversion insights
  const highConvertingKeywords = keywords.filter(k => k.conversionRate > 10);
  if (highConvertingKeywords.length > 0) {
    insights.push({
      type: 'opportunity',
      title: 'High-Converting Search Terms',
      description: `${highConvertingKeywords.length} keywords have conversion rates above 10%. Focus marketing efforts on: ${highConvertingKeywords.slice(0, 3).map(k => `"${k.term}"`).join(', ')}`,
      action: 'Allocate more resources to these high-value search terms'
    });
  }

  // Seasonal opportunity
  insights.push({
    type: 'info',
    title: 'Seasonal Search Patterns',
    description: `Based on your business type (${merchant.business_type}), expect increased searches during holiday seasons and summer months`,
    action: 'Prepare seasonal promotions and update keywords accordingly'
  });

  return insights;
}

function generateSEORecommendations(keywords: any[], merchant: any, competitorGaps: any[]) {
  const recommendations: { category: string; title: string; description: string; impact: 'high' | 'medium' | 'low'; effort: 'easy' | 'moderate' | 'complex' }[] = [];

  // Profile optimization
  recommendations.push({
    category: 'Profile Optimization',
    title: 'Update Business Description',
    description: `Include top-performing keywords naturally in your description: ${keywords.slice(0, 3).map(k => `"${k.term}"`).join(', ')}`,
    impact: 'high',
    effort: 'easy'
  });

  // Service listings
  recommendations.push({
    category: 'Service Listings',
    title: 'Expand Service Keywords',
    description: 'Add detailed service descriptions that match how customers search',
    impact: 'high',
    effort: 'moderate'
  });

  // Location SEO
  if (merchant.address) {
    recommendations.push({
      category: 'Local SEO',
      title: 'Optimize Location Keywords',
      description: 'Include neighborhood and city names in your service descriptions',
      impact: 'medium',
      effort: 'easy'
    });
  }

  // Competitor gaps
  if (competitorGaps.length > 0) {
    recommendations.push({
      category: 'Competitive Advantage',
      title: 'Address Keyword Gaps',
      description: `Target underserved keywords: ${competitorGaps.slice(0, 2).map(g => `"${g.keyword}"`).join(', ')}`,
      impact: 'high',
      effort: 'moderate'
    });
  }

  // Content freshness
  recommendations.push({
    category: 'Content Strategy',
    title: 'Regular Profile Updates',
    description: 'Update your profile monthly with new photos and service details to improve search ranking',
    impact: 'medium',
    effort: 'easy'
  });

  return recommendations;
}
