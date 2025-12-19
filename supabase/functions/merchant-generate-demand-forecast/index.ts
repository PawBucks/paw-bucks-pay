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
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Missing authorization header' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get merchant
    const serviceClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: merchant, error: merchantError } = await serviceClient
      .from('merchants')
      .select('id, business_name, business_type')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: 'Merchant not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if merchant has access to Predictive Demand Forecasting service
    const { data: serviceAccess } = await serviceClient
      .from('merchant_service_purchases')
      .select(`
        id,
        merchant_market_services!inner(name)
      `)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`);

    const hasAccess = serviceAccess?.some(
      (s: any) => s.merchant_market_services?.name === 'Predictive Demand Forecasting'
    );

    if (!hasAccess) {
      return new Response(JSON.stringify({
        has_access: false,
        message: 'This premium feature must be assigned by an admin. Contact support for access to predictive demand forecasting.'
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Fetch all transactions for this merchant
    const { data: transactions, error: txError } = await serviceClient
      .from('transactions')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw new Error('Failed to fetch transaction data');
    }

    const txData = transactions || [];
    const now = new Date();

    // Analyze historical data
    const historicalAnalysis = analyzeHistoricalData(txData);
    
    // Generate 90-day forecast
    const forecast = generate90DayForecast(txData, now);
    
    // Analyze seasonal trends
    const seasonalTrends = analyzeSeasonalTrends(txData);
    
    // Generate pricing recommendations
    const pricingRecommendations = generatePricingRecommendations(txData, seasonalTrends);
    
    // Generate inventory/staffing recommendations
    const operationalRecommendations = generateOperationalRecommendations(forecast, historicalAnalysis);
    
    // Generate AI insights
    const aiInsights = generateAIInsights(historicalAnalysis, seasonalTrends, forecast);

    const report = {
      generated_at: now.toISOString(),
      merchant_name: merchant.business_name,
      business_type: merchant.business_type,
      summary: {
        total_historical_transactions: txData.length,
        total_historical_revenue: historicalAnalysis.totalRevenue,
        avg_daily_revenue: historicalAnalysis.avgDailyRevenue,
        avg_transaction_value: historicalAnalysis.avgTransactionValue,
        forecast_confidence: calculateForecastConfidence(txData.length),
        predicted_90_day_revenue: forecast.totalPredictedRevenue,
        predicted_growth_rate: forecast.growthRate,
      },
      historical_analysis: historicalAnalysis,
      forecast_90_day: forecast,
      seasonal_trends: seasonalTrends,
      pricing_recommendations: pricingRecommendations,
      operational_recommendations: operationalRecommendations,
      ai_insights: aiInsights,
    };

    return new Response(JSON.stringify({ has_access: true, report }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Demand forecast error:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function analyzeHistoricalData(transactions: any[]) {
  if (transactions.length === 0) {
    return {
      totalRevenue: 0,
      avgDailyRevenue: 0,
      avgTransactionValue: 0,
      totalTransactions: 0,
      peakDay: null,
      peakHour: null,
      dailyTrend: [],
      weeklyAverage: [],
    };
  }

  const totalRevenue = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  const avgTransactionValue = totalRevenue / transactions.length;

  // Group by date
  const dailyMap: Record<string, { revenue: number; count: number }> = {};
  const hourlyMap: Record<number, { revenue: number; count: number }> = {};
  const dayOfWeekMap: Record<number, { revenue: number; count: number }> = {};

  transactions.forEach(tx => {
    const date = new Date(tx.created_at);
    const dateKey = date.toISOString().split('T')[0];
    const hour = date.getHours();
    const dayOfWeek = date.getDay();

    if (!dailyMap[dateKey]) dailyMap[dateKey] = { revenue: 0, count: 0 };
    dailyMap[dateKey].revenue += tx.amount || 0;
    dailyMap[dateKey].count += 1;

    if (!hourlyMap[hour]) hourlyMap[hour] = { revenue: 0, count: 0 };
    hourlyMap[hour].revenue += tx.amount || 0;
    hourlyMap[hour].count += 1;

    if (!dayOfWeekMap[dayOfWeek]) dayOfWeekMap[dayOfWeek] = { revenue: 0, count: 0 };
    dayOfWeekMap[dayOfWeek].revenue += tx.amount || 0;
    dayOfWeekMap[dayOfWeek].count += 1;
  });

  const dates = Object.keys(dailyMap).sort();
  const numDays = dates.length || 1;
  const avgDailyRevenue = totalRevenue / numDays;

  // Find peak day of week
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  let peakDay = { name: 'N/A', avgRevenue: 0 };
  Object.entries(dayOfWeekMap).forEach(([day, data]) => {
    const avgRev = data.revenue / (data.count || 1);
    if (avgRev > peakDay.avgRevenue) {
      peakDay = { name: dayNames[parseInt(day)], avgRevenue: avgRev };
    }
  });

  // Find peak hour
  let peakHour = { hour: 0, avgRevenue: 0 };
  Object.entries(hourlyMap).forEach(([hour, data]) => {
    const avgRev = data.revenue / (data.count || 1);
    if (avgRev > peakHour.avgRevenue) {
      peakHour = { hour: parseInt(hour), avgRevenue: avgRev };
    }
  });

  // Daily trend (last 30 days)
  const last30Days = dates.slice(-30).map(d => ({
    date: d,
    revenue: dailyMap[d].revenue,
    transactions: dailyMap[d].count,
  }));

  // Weekly averages by day
  const weeklyAverage = dayNames.map((name, idx) => ({
    day: name,
    avgRevenue: dayOfWeekMap[idx]?.revenue / (dayOfWeekMap[idx]?.count || 1) || 0,
    avgTransactions: dayOfWeekMap[idx]?.count / numDays * 7 || 0,
  }));

  return {
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    avgDailyRevenue: Math.round(avgDailyRevenue * 100) / 100,
    avgTransactionValue: Math.round(avgTransactionValue * 100) / 100,
    totalTransactions: transactions.length,
    peakDay: peakDay.name,
    peakHour: `${peakHour.hour}:00 - ${peakHour.hour + 1}:00`,
    dailyTrend: last30Days,
    weeklyAverage,
  };
}

function generate90DayForecast(transactions: any[], now: Date) {
  // Group transactions by week
  const weeklyMap: Record<string, number> = {};
  transactions.forEach(tx => {
    const date = new Date(tx.created_at);
    const weekStart = getWeekStart(date);
    if (!weeklyMap[weekStart]) weeklyMap[weekStart] = 0;
    weeklyMap[weekStart] += tx.amount || 0;
  });

  const weeks = Object.entries(weeklyMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, revenue]) => ({ week, revenue }));

  // Calculate trend using simple linear regression
  const n = weeks.length;
  let trend = 0;
  let baseRevenue = 0;

  if (n >= 2) {
    const xMean = (n - 1) / 2;
    const yMean = weeks.reduce((sum, w) => sum + w.revenue, 0) / n;
    let numerator = 0;
    let denominator = 0;

    weeks.forEach((w, i) => {
      numerator += (i - xMean) * (w.revenue - yMean);
      denominator += (i - xMean) ** 2;
    });

    trend = denominator !== 0 ? numerator / denominator : 0;
    baseRevenue = yMean - trend * xMean;
  } else if (n === 1) {
    baseRevenue = weeks[0].revenue;
  }

  // Generate daily forecast for next 90 days
  const dailyForecast: { date: string; predicted_revenue: number; confidence: string }[] = [];
  const avgDailyMultiplier = transactions.length > 0 
    ? 1 / 7 // Weekly to daily
    : 0;

  let totalPredicted = 0;
  for (let i = 0; i < 90; i++) {
    const forecastDate = new Date(now);
    forecastDate.setDate(forecastDate.getDate() + i);
    
    const weekNumber = n + Math.floor(i / 7);
    const predictedWeeklyRevenue = Math.max(0, baseRevenue + trend * weekNumber);
    const predictedDaily = predictedWeeklyRevenue * avgDailyMultiplier;
    
    // Add some variance based on day of week
    const dayOfWeek = forecastDate.getDay();
    const dayMultiplier = getDayMultiplier(dayOfWeek);
    const finalPrediction = predictedDaily * dayMultiplier;

    dailyForecast.push({
      date: forecastDate.toISOString().split('T')[0],
      predicted_revenue: Math.round(finalPrediction * 100) / 100,
      confidence: i < 30 ? 'high' : i < 60 ? 'medium' : 'low',
    });

    totalPredicted += finalPrediction;
  }

  // Weekly aggregated forecast
  const weeklyForecast: { week: string; predicted_revenue: number; growth_vs_prev: number }[] = [];
  for (let w = 0; w < 13; w++) {
    const weekStart = w * 7;
    const weekRevenue = dailyForecast.slice(weekStart, weekStart + 7)
      .reduce((sum, d) => sum + d.predicted_revenue, 0);
    
    const prevWeekRevenue = weeklyForecast[w - 1]?.predicted_revenue || weekRevenue;
    const growth = prevWeekRevenue > 0 
      ? ((weekRevenue - prevWeekRevenue) / prevWeekRevenue) * 100 
      : 0;

    weeklyForecast.push({
      week: `Week ${w + 1}`,
      predicted_revenue: Math.round(weekRevenue * 100) / 100,
      growth_vs_prev: Math.round(growth * 10) / 10,
    });
  }

  // Monthly aggregated forecast
  const monthlyForecast = [
    { month: 'Month 1', predicted_revenue: dailyForecast.slice(0, 30).reduce((s, d) => s + d.predicted_revenue, 0) },
    { month: 'Month 2', predicted_revenue: dailyForecast.slice(30, 60).reduce((s, d) => s + d.predicted_revenue, 0) },
    { month: 'Month 3', predicted_revenue: dailyForecast.slice(60, 90).reduce((s, d) => s + d.predicted_revenue, 0) },
  ].map(m => ({ ...m, predicted_revenue: Math.round(m.predicted_revenue * 100) / 100 }));

  // Calculate growth rate
  const historicalWeeklyAvg = n > 0 ? weeks.reduce((s, w) => s + w.revenue, 0) / n : 0;
  const forecastWeeklyAvg = totalPredicted / 13;
  const growthRate = historicalWeeklyAvg > 0 
    ? ((forecastWeeklyAvg - historicalWeeklyAvg) / historicalWeeklyAvg) * 100 
    : 0;

  return {
    daily: dailyForecast,
    weekly: weeklyForecast,
    monthly: monthlyForecast,
    totalPredictedRevenue: Math.round(totalPredicted * 100) / 100,
    growthRate: Math.round(growthRate * 10) / 10,
  };
}

function analyzeSeasonalTrends(transactions: any[]) {
  const monthlyMap: Record<number, { revenue: number; count: number }> = {};
  const quarterlyMap: Record<number, { revenue: number; count: number }> = {};

  transactions.forEach(tx => {
    const date = new Date(tx.created_at);
    const month = date.getMonth();
    const quarter = Math.floor(month / 3);

    if (!monthlyMap[month]) monthlyMap[month] = { revenue: 0, count: 0 };
    monthlyMap[month].revenue += tx.amount || 0;
    monthlyMap[month].count += 1;

    if (!quarterlyMap[quarter]) quarterlyMap[quarter] = { revenue: 0, count: 0 };
    quarterlyMap[quarter].revenue += tx.amount || 0;
    quarterlyMap[quarter].count += 1;
  });

  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const quarterNames = ['Q1 (Jan-Mar)', 'Q2 (Apr-Jun)', 'Q3 (Jul-Sep)', 'Q4 (Oct-Dec)'];

  const monthlyTrends = monthNames.map((name, idx) => ({
    month: name,
    avgRevenue: Math.round((monthlyMap[idx]?.revenue || 0) / Math.max(1, monthlyMap[idx]?.count || 1) * 100) / 100,
    totalRevenue: Math.round((monthlyMap[idx]?.revenue || 0) * 100) / 100,
    transactions: monthlyMap[idx]?.count || 0,
  }));

  const quarterlyTrends = quarterNames.map((name, idx) => ({
    quarter: name,
    totalRevenue: Math.round((quarterlyMap[idx]?.revenue || 0) * 100) / 100,
    transactions: quarterlyMap[idx]?.count || 0,
  }));

  // Identify peak and low seasons
  const peakMonth = monthlyTrends.reduce((max, m) => m.totalRevenue > max.totalRevenue ? m : max, monthlyTrends[0]);
  const lowMonth = monthlyTrends.reduce((min, m) => 
    m.totalRevenue < min.totalRevenue && m.transactions > 0 ? m : min, monthlyTrends[0]);

  return {
    monthly: monthlyTrends,
    quarterly: quarterlyTrends,
    peakSeason: peakMonth?.month || 'N/A',
    lowSeason: lowMonth?.month || 'N/A',
    seasonalVariance: calculateSeasonalVariance(monthlyTrends),
  };
}

function generatePricingRecommendations(transactions: any[], seasonalTrends: any) {
  const avgPrice = transactions.length > 0
    ? transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0) / transactions.length
    : 0;

  const recommendations: { type: string; recommendation: string; impact: string; priority: 'high' | 'medium' | 'low' }[] = [];

  // Peak season pricing
  if (seasonalTrends.peakSeason !== 'N/A') {
    recommendations.push({
      type: 'Peak Season Pricing',
      recommendation: `Consider a 10-15% price increase during ${seasonalTrends.peakSeason} when demand is highest`,
      impact: 'Potential 8-12% revenue increase',
      priority: 'high',
    });
  }

  // Low season promotions
  if (seasonalTrends.lowSeason !== 'N/A' && seasonalTrends.lowSeason !== seasonalTrends.peakSeason) {
    recommendations.push({
      type: 'Off-Peak Promotions',
      recommendation: `Offer 15-20% discounts during ${seasonalTrends.lowSeason} to maintain customer flow`,
      impact: 'Maintain 70-80% of peak revenue',
      priority: 'medium',
    });
  }

  // Bundle pricing
  if (avgPrice > 0) {
    recommendations.push({
      type: 'Bundle Strategy',
      recommendation: `Create service bundles at $${Math.round(avgPrice * 2.5)} (2.5x avg) to increase transaction value`,
      impact: 'Potential 15-25% increase in average order value',
      priority: 'medium',
    });
  }

  // Loyalty pricing
  recommendations.push({
    type: 'Loyalty Discounts',
    recommendation: 'Offer 5-10% discount for repeat customers to improve retention',
    impact: 'Potential 20-30% increase in customer lifetime value',
    priority: 'high',
  });

  // Dynamic pricing
  recommendations.push({
    type: 'Dynamic Pricing',
    recommendation: 'Implement time-based pricing: higher rates during peak hours, lower during off-peak',
    impact: 'Potential 10-15% overall revenue optimization',
    priority: 'low',
  });

  return recommendations;
}

function generateOperationalRecommendations(forecast: any, historicalAnalysis: any) {
  const recommendations: { category: string; recommendation: string; timing: string; priority: 'high' | 'medium' | 'low' }[] = [];

  // Staffing recommendations
  if (historicalAnalysis.peakDay) {
    recommendations.push({
      category: 'Staffing',
      recommendation: `Increase staffing by 20-30% on ${historicalAnalysis.peakDay}s based on historical peak demand`,
      timing: 'Weekly',
      priority: 'high',
    });
  }

  if (historicalAnalysis.peakHour) {
    recommendations.push({
      category: 'Staffing',
      recommendation: `Schedule additional staff during ${historicalAnalysis.peakHour} - your busiest time`,
      timing: 'Daily',
      priority: 'high',
    });
  }

  // Inventory recommendations based on forecast
  if (forecast.growthRate > 10) {
    recommendations.push({
      category: 'Inventory',
      recommendation: `Increase inventory by ${Math.round(forecast.growthRate)}% to meet predicted demand growth`,
      timing: 'Next 30 days',
      priority: 'high',
    });
  } else if (forecast.growthRate < -10) {
    recommendations.push({
      category: 'Inventory',
      recommendation: 'Consider reducing inventory orders by 10-15% based on declining demand forecast',
      timing: 'Next 30 days',
      priority: 'medium',
    });
  }

  // Capacity planning
  recommendations.push({
    category: 'Capacity Planning',
    recommendation: `Plan for $${Math.round(forecast.monthly[0]?.predicted_revenue || 0)} in Month 1, $${Math.round(forecast.monthly[1]?.predicted_revenue || 0)} in Month 2`,
    timing: 'Next 90 days',
    priority: 'medium',
  });

  // Marketing timing
  if (forecast.weekly.some((w: any) => w.growth_vs_prev < -5)) {
    recommendations.push({
      category: 'Marketing',
      recommendation: 'Schedule promotional campaigns during predicted slow weeks to maintain revenue',
      timing: 'As needed',
      priority: 'medium',
    });
  }

  // Resource optimization
  recommendations.push({
    category: 'Resource Optimization',
    recommendation: 'Review and optimize service delivery during low-demand periods to reduce costs',
    timing: 'Monthly',
    priority: 'low',
  });

  return recommendations;
}

function generateAIInsights(historicalAnalysis: any, seasonalTrends: any, forecast: any) {
  const insights: string[] = [];

  // Revenue insight
  if (forecast.growthRate > 0) {
    insights.push(`📈 Your business is projected to grow ${forecast.growthRate}% over the next 90 days based on current trends.`);
  } else if (forecast.growthRate < 0) {
    insights.push(`📉 Forecast shows a ${Math.abs(forecast.growthRate)}% decline. Consider promotional activities to reverse this trend.`);
  } else {
    insights.push(`📊 Revenue is projected to remain stable over the next 90 days.`);
  }

  // Peak performance insight
  if (historicalAnalysis.peakDay && historicalAnalysis.peakHour) {
    insights.push(`⏰ Peak business hours are on ${historicalAnalysis.peakDay}s around ${historicalAnalysis.peakHour}. Focus marketing and staffing on these times.`);
  }

  // Seasonal insight
  if (seasonalTrends.seasonalVariance > 30) {
    insights.push(`🌡️ High seasonal variance detected (${Math.round(seasonalTrends.seasonalVariance)}%). Plan for significant demand fluctuations throughout the year.`);
  } else if (seasonalTrends.seasonalVariance < 10) {
    insights.push(`📅 Your business shows consistent demand throughout the year with low seasonal variance.`);
  }

  // Transaction value insight
  if (historicalAnalysis.avgTransactionValue > 0) {
    const targetIncrease = Math.round(historicalAnalysis.avgTransactionValue * 1.15);
    insights.push(`💰 Current average transaction is $${historicalAnalysis.avgTransactionValue}. Target $${targetIncrease} through upselling to boost revenue by 15%.`);
  }

  // Customer behavior insight
  if (historicalAnalysis.totalTransactions > 100) {
    insights.push(`👥 Strong transaction volume (${historicalAnalysis.totalTransactions}+ transactions) provides high confidence in forecast accuracy.`);
  } else if (historicalAnalysis.totalTransactions > 0) {
    insights.push(`📊 Building transaction history. Forecast accuracy will improve as more data is collected.`);
  }

  // Growth opportunity
  if (forecast.monthly[2]?.predicted_revenue > forecast.monthly[0]?.predicted_revenue) {
    insights.push(`🚀 Month 3 is projected to be your strongest month. Prepare resources accordingly.`);
  }

  return insights;
}

// Helper functions
function getWeekStart(date: Date): string {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  return d.toISOString().split('T')[0];
}

function getDayMultiplier(dayOfWeek: number): number {
  // Typical retail pattern: higher on weekends
  const multipliers = [1.1, 0.85, 0.9, 0.95, 1.0, 1.15, 1.2];
  return multipliers[dayOfWeek];
}

function calculateForecastConfidence(txCount: number): string {
  if (txCount >= 200) return 'High';
  if (txCount >= 50) return 'Medium';
  if (txCount >= 10) return 'Low';
  return 'Very Low';
}

function calculateSeasonalVariance(monthlyTrends: any[]): number {
  const revenues = monthlyTrends.filter(m => m.transactions > 0).map(m => m.totalRevenue);
  if (revenues.length < 2) return 0;
  
  const mean = revenues.reduce((s, r) => s + r, 0) / revenues.length;
  if (mean === 0) return 0;
  
  const variance = revenues.reduce((s, r) => s + Math.pow(r - mean, 2), 0) / revenues.length;
  const stdDev = Math.sqrt(variance);
  
  return (stdDev / mean) * 100;
}
