import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get auth header
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action, merchantId, dateRange, event } = await req.json();

    // Verify merchant ownership
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, business_name")
      .eq("id", merchantId)
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: "Merchant not found or access denied" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Handle different actions
    switch (action) {
      case "track":
        return await trackEvent(supabase, event, merchantId, corsHeaders);
      case "getAnalytics":
        return await getAnalytics(supabase, merchantId, dateRange, corsHeaders);
      case "getCompetitorBenchmark":
        return await getCompetitorBenchmark(supabase, merchantId, corsHeaders);
      case "getAIRecommendations":
        return await getAIRecommendations(supabase, merchantId, dateRange, corsHeaders);
      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error: unknown) {
    console.error("Error in sponsored-placement-analytics:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function trackEvent(supabase: any, event: any, merchantId: string, corsHeaders: any) {
  const { data, error } = await supabase
    .from("sponsored_placement_analytics")
    .insert({
      merchant_id: merchantId,
      event_type: event.type,
      source_page: event.source,
      user_id: event.userId || null,
      session_id: event.sessionId || null,
      search_query: event.searchQuery || null,
      position: event.position || null,
      device_type: event.deviceType || null,
    });

  if (error) {
    console.error("Error tracking event:", error);
    return new Response(JSON.stringify({ error: "Failed to track event" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAnalytics(supabase: any, merchantId: string, dateRange: { start: string; end: string }, corsHeaders: any) {
  const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = dateRange?.end || new Date().toISOString();

  // Get raw analytics data
  const { data: rawAnalytics, error: analyticsError } = await supabase
    .from("sponsored_placement_analytics")
    .select("*")
    .eq("merchant_id", merchantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .order("created_at", { ascending: false });

  if (analyticsError) {
    console.error("Error fetching analytics:", analyticsError);
    return new Response(JSON.stringify({ error: "Failed to fetch analytics" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get service purchase details
  const { data: servicePurchase, error: purchaseError } = await supabase
    .from("merchant_service_purchases")
    .select(`
      *,
      merchant_market_services!inner(name)
    `)
    .eq("merchant_id", merchantId)
    .eq("status", "active")
    .ilike("merchant_market_services.name", "%Sponsored%")
    .maybeSingle();

  // Get transactions during this period (for conversion/ROI tracking)
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("id, amount, created_at, user_id")
    .eq("merchant_id", merchantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate)
    .eq("status", "completed");

  // Calculate metrics
  const impressions = rawAnalytics?.filter((a: any) => a.event_type === "impression") || [];
  const clicks = rawAnalytics?.filter((a: any) => a.event_type === "click") || [];
  const conversions = rawAnalytics?.filter((a: any) => a.event_type === "conversion") || [];

  const totalImpressions = impressions.length;
  const totalClicks = clicks.length;
  const totalConversions = conversions.length;
  const ctr = totalImpressions > 0 ? (totalClicks / totalImpressions) * 100 : 0;
  const conversionRate = totalClicks > 0 ? (totalConversions / totalClicks) * 100 : 0;

  // Calculate source breakdown
  const sourceBreakdown = {
    discover: { impressions: 0, clicks: 0, conversions: 0 },
    directory: { impressions: 0, clicks: 0, conversions: 0 },
    map: { impressions: 0, clicks: 0, conversions: 0 },
    search: { impressions: 0, clicks: 0, conversions: 0 },
  };

  (rawAnalytics || []).forEach((event: any) => {
    const source = event.source_page as keyof typeof sourceBreakdown;
    if (sourceBreakdown[source]) {
      if (event.event_type === "impression") sourceBreakdown[source].impressions++;
      if (event.event_type === "click") sourceBreakdown[source].clicks++;
      if (event.event_type === "conversion") sourceBreakdown[source].conversions++;
    }
  });

  // Calculate daily trends
  const dailyTrends: Record<string, { impressions: number; clicks: number; conversions: number }> = {};
  (rawAnalytics || []).forEach((event: any) => {
    const date = new Date(event.created_at).toISOString().split("T")[0];
    if (!dailyTrends[date]) {
      dailyTrends[date] = { impressions: 0, clicks: 0, conversions: 0 };
    }
    if (event.event_type === "impression") dailyTrends[date].impressions++;
    if (event.event_type === "click") dailyTrends[date].clicks++;
    if (event.event_type === "conversion") dailyTrends[date].conversions++;
  });

  // Calculate unique viewers
  const uniqueViewers = new Set(
    (rawAnalytics || [])
      .map((e: any) => e.user_id || e.session_id)
      .filter(Boolean)
  ).size;

  // Calculate average position
  const positions = (rawAnalytics || [])
    .filter((e: any) => e.position !== null)
    .map((e: any) => e.position);
  const avgPosition = positions.length > 0 
    ? positions.reduce((a: number, b: number) => a + b, 0) / positions.length 
    : 1;

  // Calculate ROI
  const totalRevenue = (transactions || []).reduce((sum: number, tx: any) => sum + tx.amount, 0);
  const investmentCost = servicePurchase?.amount_paid_usd || 0;
  const roi = investmentCost > 0 ? ((totalRevenue - investmentCost) / investmentCost) * 100 : 0;

  // Calculate peak hours
  const hourlyDistribution: Record<number, number> = {};
  (rawAnalytics || []).forEach((event: any) => {
    const hour = new Date(event.created_at).getHours();
    hourlyDistribution[hour] = (hourlyDistribution[hour] || 0) + 1;
  });

  const peakHours = Object.entries(hourlyDistribution)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([hour]) => parseInt(hour));

  // Device breakdown
  const deviceBreakdown: Record<string, number> = {};
  (rawAnalytics || []).forEach((event: any) => {
    const device = event.device_type || "unknown";
    deviceBreakdown[device] = (deviceBreakdown[device] || 0) + 1;
  });

  const response = {
    overview: {
      totalImpressions,
      totalClicks,
      totalConversions,
      ctr: parseFloat(ctr.toFixed(2)),
      conversionRate: parseFloat(conversionRate.toFixed(2)),
      uniqueViewers,
      avgPosition: parseFloat(avgPosition.toFixed(1)),
      revenue: totalRevenue,
      roi: parseFloat(roi.toFixed(2)),
    },
    sourceBreakdown,
    dailyTrends: Object.entries(dailyTrends)
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date)),
    peakHours,
    deviceBreakdown,
    subscription: servicePurchase ? {
      startDate: servicePurchase.created_at,
      expiresAt: servicePurchase.expires_at,
      daysRemaining: servicePurchase.expires_at 
        ? Math.max(0, Math.ceil((new Date(servicePurchase.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
        : null,
      amountPaid: servicePurchase.amount_paid_usd || 0,
    } : null,
  };

  return new Response(JSON.stringify(response), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getCompetitorBenchmark(supabase: any, merchantId: string, corsHeaders: any) {
  // Get merchant's business type
  const { data: merchant, error: merchantError } = await supabase
    .from("merchants")
    .select("business_type")
    .eq("id", merchantId)
    .single();

  if (merchantError || !merchant) {
    return new Response(JSON.stringify({ error: "Merchant not found" }), {
      status: 404,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Get all sponsored merchants in same business type
  const { data: competitors, error: competitorsError } = await supabase
    .from("merchants")
    .select("id, business_name")
    .eq("business_type", merchant.business_type)
    .neq("id", merchantId);

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // Get analytics for all competitors
  const competitorIds = competitors?.map((c: any) => c.id) || [];
  
  const { data: allAnalytics, error: analyticsError } = await supabase
    .from("sponsored_placement_analytics")
    .select("merchant_id, event_type")
    .in("merchant_id", [merchantId, ...competitorIds])
    .gte("created_at", thirtyDaysAgo);

  // Calculate metrics per merchant
  const merchantMetrics: Record<string, { impressions: number; clicks: number; conversions: number }> = {};
  
  (allAnalytics || []).forEach((event: any) => {
    if (!merchantMetrics[event.merchant_id]) {
      merchantMetrics[event.merchant_id] = { impressions: 0, clicks: 0, conversions: 0 };
    }
    if (event.event_type === "impression") merchantMetrics[event.merchant_id].impressions++;
    if (event.event_type === "click") merchantMetrics[event.merchant_id].clicks++;
    if (event.event_type === "conversion") merchantMetrics[event.merchant_id].conversions++;
  });

  // Calculate your metrics
  const yourMetrics = merchantMetrics[merchantId] || { impressions: 0, clicks: 0, conversions: 0 };
  const yourCTR = yourMetrics.impressions > 0 ? (yourMetrics.clicks / yourMetrics.impressions) * 100 : 0;
  const yourConversionRate = yourMetrics.clicks > 0 ? (yourMetrics.conversions / yourMetrics.clicks) * 100 : 0;

  // Calculate industry averages
  const allMetricsArray = Object.values(merchantMetrics);
  const avgImpressions = allMetricsArray.length > 0
    ? allMetricsArray.reduce((sum, m) => sum + m.impressions, 0) / allMetricsArray.length
    : 0;
  const avgClicks = allMetricsArray.length > 0
    ? allMetricsArray.reduce((sum, m) => sum + m.clicks, 0) / allMetricsArray.length
    : 0;
  const avgConversions = allMetricsArray.length > 0
    ? allMetricsArray.reduce((sum, m) => sum + m.conversions, 0) / allMetricsArray.length
    : 0;
  const industryAvgCTR = avgImpressions > 0 ? (avgClicks / avgImpressions) * 100 : 0;
  const industryAvgConversionRate = avgClicks > 0 ? (avgConversions / avgClicks) * 100 : 0;

  // Calculate rank
  const rankedByImpressions = Object.entries(merchantMetrics)
    .sort((a, b) => b[1].impressions - a[1].impressions);
  const yourRank = rankedByImpressions.findIndex(([id]) => id === merchantId) + 1;

  // Calculate performance score
  const ctrScore = industryAvgCTR > 0 ? Math.min(100, (yourCTR / industryAvgCTR) * 50) : 50;
  const convScore = industryAvgConversionRate > 0 ? Math.min(100, (yourConversionRate / industryAvgConversionRate) * 50) : 50;
  const performanceScore = Math.round((ctrScore + convScore));

  return new Response(JSON.stringify({
    yourMetrics: {
      impressions: yourMetrics.impressions,
      clicks: yourMetrics.clicks,
      conversions: yourMetrics.conversions,
      ctr: parseFloat(yourCTR.toFixed(2)),
      conversionRate: parseFloat(yourConversionRate.toFixed(2)),
    },
    industryAverages: {
      impressions: Math.round(avgImpressions),
      clicks: Math.round(avgClicks),
      conversions: Math.round(avgConversions),
      ctr: parseFloat(industryAvgCTR.toFixed(2)),
      conversionRate: parseFloat(industryAvgConversionRate.toFixed(2)),
    },
    ranking: {
      position: yourRank || 1,
      totalCompetitors: rankedByImpressions.length,
      percentile: rankedByImpressions.length > 0 
        ? Math.round(((rankedByImpressions.length - yourRank + 1) / rankedByImpressions.length) * 100)
        : 100,
    },
    performanceScore,
    businessType: merchant.business_type,
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getAIRecommendations(supabase: any, merchantId: string, dateRange: any, corsHeaders: any) {
  const startDate = dateRange?.start || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const endDate = dateRange?.end || new Date().toISOString();

  // Get analytics data
  const { data: analytics } = await supabase
    .from("sponsored_placement_analytics")
    .select("*")
    .eq("merchant_id", merchantId)
    .gte("created_at", startDate)
    .lte("created_at", endDate);

  // Get merchant details
  const { data: merchant } = await supabase
    .from("merchants")
    .select("*")
    .eq("id", merchantId)
    .single();

  // Calculate metrics for recommendations
  const impressions = analytics?.filter((a: any) => a.event_type === "impression")?.length || 0;
  const clicks = analytics?.filter((a: any) => a.event_type === "click")?.length || 0;
  const conversions = analytics?.filter((a: any) => a.event_type === "conversion")?.length || 0;
  const ctr = impressions > 0 ? (clicks / impressions) * 100 : 0;
  const conversionRate = clicks > 0 ? (conversions / clicks) * 100 : 0;

  // Source analysis
  const sourceBreakdown: Record<string, number> = {};
  (analytics || []).forEach((e: any) => {
    sourceBreakdown[e.source_page] = (sourceBreakdown[e.source_page] || 0) + 1;
  });
  const topSource = Object.entries(sourceBreakdown).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Peak hours
  const hourlyData: Record<number, number> = {};
  (analytics || []).forEach((e: any) => {
    const hour = new Date(e.created_at).getHours();
    hourlyData[hour] = (hourlyData[hour] || 0) + 1;
  });
  const peakHour = Object.entries(hourlyData).sort((a, b) => b[1] - a[1])[0]?.[0];

  // Generate AI-powered recommendations
  const recommendations: Array<{
    type: "opportunity" | "warning" | "insight" | "action";
    title: string;
    description: string;
    priority: "high" | "medium" | "low";
    potentialImpact: string;
  }> = [];

  // CTR-based recommendations
  if (ctr < 2) {
    recommendations.push({
      type: "warning",
      title: "Low Click-Through Rate",
      description: "Your CTR is below industry average. Consider updating your business logo, description, and ensuring your cashback rate is competitive.",
      priority: "high",
      potentialImpact: "Could increase clicks by 30-50%",
    });
  } else if (ctr > 5) {
    recommendations.push({
      type: "insight",
      title: "Excellent CTR Performance",
      description: "Your click-through rate is above average. Your listing is attracting strong interest from pet owners.",
      priority: "low",
      potentialImpact: "Maintain current strategy",
    });
  }

  // Conversion-based recommendations
  if (conversionRate < 5) {
    recommendations.push({
      type: "action",
      title: "Improve Conversion Optimization",
      description: "Visitors are clicking but not converting. Ensure your profile highlights unique value propositions, reviews, and special offers.",
      priority: "high",
      potentialImpact: "Could increase revenue by 20-40%",
    });
  }

  // Source-based recommendations
  if (topSource) {
    const sourceNames: Record<string, string> = {
      discover: "Discover page",
      directory: "Merchant Directory",
      map: "Map view",
      search: "Search results",
    };
    recommendations.push({
      type: "insight",
      title: `Top Performing Channel: ${sourceNames[topSource] || topSource}`,
      description: `Most of your visibility comes from ${sourceNames[topSource]}. Consider optimizing your presence on other channels for balanced exposure.`,
      priority: "medium",
      potentialImpact: "Could diversify traffic sources by 25%",
    });
  }

  // Time-based recommendations
  if (peakHour) {
    const hour = parseInt(peakHour);
    const period = hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
    recommendations.push({
      type: "opportunity",
      title: `Peak Activity: ${period.charAt(0).toUpperCase() + period.slice(1)}`,
      description: `Your peak visibility occurs during ${period} hours (around ${hour}:00). Consider timing any promotions or updates for maximum impact.`,
      priority: "medium",
      potentialImpact: "Optimize engagement timing",
    });
  }

  // Profile optimization
  if (!merchant?.description || merchant.description.length < 100) {
    recommendations.push({
      type: "action",
      title: "Enhance Business Description",
      description: "A detailed business description helps pet owners understand your services better. Aim for at least 100 characters with key services highlighted.",
      priority: "medium",
      potentialImpact: "Could improve CTR by 15-25%",
    });
  }

  if (!merchant?.logo_url) {
    recommendations.push({
      type: "warning",
      title: "Add Business Logo",
      description: "Listings with logos get significantly more clicks. Upload a professional logo to stand out in search results.",
      priority: "high",
      potentialImpact: "Could increase visibility by 40%",
    });
  }

  // Cashback optimization
  if (merchant?.cashback_rate < 2) {
    recommendations.push({
      type: "opportunity",
      title: "Increase Cashback Rate",
      description: "Consider increasing your points multiplier. Higher cashback rates attract more budget-conscious pet owners.",
      priority: "medium",
      potentialImpact: "Could increase conversions by 20%",
    });
  }

  // Predictions
  const projectedImpressions = Math.round(impressions * 1.1); // 10% growth assumption
  const projectedClicks = Math.round(projectedImpressions * (ctr / 100));
  const projectedConversions = Math.round(projectedClicks * (conversionRate / 100));

  return new Response(JSON.stringify({
    recommendations: recommendations.sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }),
    predictions: {
      nextMonth: {
        impressions: projectedImpressions,
        clicks: projectedClicks,
        conversions: projectedConversions,
      },
      growthRate: 10,
    },
    healthScore: Math.min(100, Math.round(
      (ctr > 2 ? 25 : ctr * 12.5) +
      (conversionRate > 10 ? 25 : conversionRate * 2.5) +
      (merchant?.logo_url ? 25 : 0) +
      (merchant?.description && merchant.description.length > 100 ? 25 : 12.5)
    )),
  }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}