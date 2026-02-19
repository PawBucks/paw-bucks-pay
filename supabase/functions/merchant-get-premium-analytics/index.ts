import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    // Parse request body for date range
    let startDate: Date | null = null;
    let endDate: Date | null = null;
    
    try {
      const body = await req.json();
      if (body.startDate) startDate = new Date(body.startDate);
      if (body.endDate) endDate = new Date(body.endDate);
    } catch {
      // No body or invalid JSON - use defaults
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } }
    );

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('merchants')
      .select('id, business_name, cashback_rate, created_at, business_type')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    // Check if merchant has Premium Analytics Dashboard service assigned
    const { data: serviceAssignment } = await serviceClient
      .from('merchant_service_purchases')
      .select(`
        id,
        status,
        expires_at,
        merchant_market_services!inner(name)
      `)
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .eq('merchant_market_services.name', 'Premium Analytics Dashboard')
      .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
      .maybeSingle();

    // Also check legacy subscription table
    const { data: subscription } = await supabaseClient
      .from('merchant_analytics_subscriptions')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .gte('end_date', new Date().toISOString())
      .maybeSingle();

    if (!serviceAssignment && !subscription) {
      return new Response(
        JSON.stringify({ 
          has_access: false,
          message: 'Premium Analytics Dashboard service required. Contact admin or purchase from Merchant Market.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // ======= COMPREHENSIVE ANALYTICS QUERIES =======
    
    // Get all transactions for this merchant
    const { data: allTransactions } = await serviceClient
      .from('transactions')
      .select('*')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: false });

    const transactions = allTransactions || [];
    
    // Time periods
    const now = endDate || new Date();
    const thirtyDaysAgo = startDate || new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(thirtyDaysAgo.getTime() - 30 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Filter by custom date range
    const customRangeTransactions = transactions.filter(t => {
      const date = new Date(t.created_at);
      return date >= thirtyDaysAgo && date <= now;
    });

    // Filter by time periods
    const last30Days = customRangeTransactions;
    const prev30Days = transactions.filter(t => {
      const date = new Date(t.created_at);
      return date > sixtyDaysAgo && date <= thirtyDaysAgo;
    });
    const last90Days = transactions.filter(t => new Date(t.created_at) > ninetyDaysAgo);
    const lastYear = transactions.filter(t => new Date(t.created_at) > oneYearAgo);

    // ======= KEY METRICS =======
    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalRewards = transactions.reduce((sum, t) => sum + Number(t.rewards_earned), 0);
    const totalTransactions = transactions.length;
    const uniqueCustomers = new Set(transactions.map(t => t.user_id)).size;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Custom range metrics
    const revenueCustomRange = last30Days.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionsCustomRange = last30Days.length;
    const customersCustomRange = new Set(last30Days.map(t => t.user_id)).size;

    // Previous period for comparison
    const revenuePrevPeriod = prev30Days.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionsPrevPeriod = prev30Days.length;
    const customersPrevPeriod = new Set(prev30Days.map(t => t.user_id)).size;

    // Growth rates
    const revenueGrowth = revenuePrevPeriod > 0 
      ? ((revenueCustomRange - revenuePrevPeriod) / revenuePrevPeriod) * 100 
      : 0;
    const transactionGrowth = transactionsPrevPeriod > 0 
      ? ((transactionsCustomRange - transactionsPrevPeriod) / transactionsPrevPeriod) * 100 
      : 0;
    const customerGrowth = customersPrevPeriod > 0 
      ? ((customersCustomRange - customersPrevPeriod) / customersPrevPeriod) * 100 
      : 0;

    // ======= TRANSACTION VELOCITY =======
    const daysDiff = Math.max(1, Math.ceil((now.getTime() - thirtyDaysAgo.getTime()) / (24 * 60 * 60 * 1000)));
    const dailyTransactionVelocity = transactionsCustomRange / daysDiff;
    const dailyRevenueVelocity = revenueCustomRange / daysDiff;
    const weeklyTransactionVelocity = dailyTransactionVelocity * 7;
    const weeklyRevenueVelocity = dailyRevenueVelocity * 7;

    // Calculate velocity trends (compare to previous period)
    const prevDailyVelocity = transactionsPrevPeriod / daysDiff;
    const velocityGrowth = prevDailyVelocity > 0 
      ? ((dailyTransactionVelocity - prevDailyVelocity) / prevDailyVelocity) * 100 
      : 0;

    // ======= REVENUE TRENDS (Daily for selected period) =======
    const revenueByDay: Record<string, { revenue: number; transactions: number; date: string }> = {};
    const numDays = Math.min(daysDiff, 60); // Cap at 60 days for visualization
    for (let i = numDays - 1; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      revenueByDay[dateKey] = { revenue: 0, transactions: 0, date: dateKey };
    }
    last30Days.forEach(t => {
      const dateKey = new Date(t.created_at).toISOString().split('T')[0];
      if (revenueByDay[dateKey]) {
        revenueByDay[dateKey].revenue += Number(t.amount);
        revenueByDay[dateKey].transactions += 1;
      }
    });

    // ======= MONTHLY REVENUE TRENDS (Last 12 months) =======
    const monthlyRevenue: Record<string, { revenue: number; transactions: number; month: string }> = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthName = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      monthlyRevenue[monthKey] = { revenue: 0, transactions: 0, month: monthName };
    }
    lastYear.forEach(t => {
      const date = new Date(t.created_at);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      if (monthlyRevenue[monthKey]) {
        monthlyRevenue[monthKey].revenue += Number(t.amount);
        monthlyRevenue[monthKey].transactions += 1;
      }
    });

    // ======= CUSTOMER BEHAVIOR =======
    const customerPurchases: Record<string, { 
      count: number; 
      total: number; 
      firstPurchase: Date; 
      lastPurchase: Date;
      amounts: number[];
    }> = {};
    transactions.forEach(t => {
      const userId = t.user_id;
      const amount = Number(t.amount);
      const date = new Date(t.created_at);
      
      if (!customerPurchases[userId]) {
        customerPurchases[userId] = { count: 0, total: 0, firstPurchase: date, lastPurchase: date, amounts: [] };
      }
      customerPurchases[userId].count += 1;
      customerPurchases[userId].total += amount;
      customerPurchases[userId].amounts.push(amount);
      if (date < customerPurchases[userId].firstPurchase) {
        customerPurchases[userId].firstPurchase = date;
      }
      if (date > customerPurchases[userId].lastPurchase) {
        customerPurchases[userId].lastPurchase = date;
      }
    });

    // Customer segments
    const oneTimeBuyers = Object.values(customerPurchases).filter(c => c.count === 1).length;
    const repeatBuyers = Object.values(customerPurchases).filter(c => c.count > 1).length;
    const loyalCustomers = Object.values(customerPurchases).filter(c => c.count >= 5).length;
    const vipCustomers = Object.values(customerPurchases).filter(c => c.total >= 500).length;

    // Average lifetime value
    const avgLifetimeValue = uniqueCustomers > 0 
      ? Object.values(customerPurchases).reduce((sum, c) => sum + c.total, 0) / uniqueCustomers 
      : 0;

    // Repeat purchase rate
    const repeatPurchaseRate = uniqueCustomers > 0 
      ? (repeatBuyers / uniqueCustomers) * 100 
      : 0;

    // ======= CUSTOMER DEMOGRAPHICS / BEHAVIOR ANALYSIS =======
    // New vs returning in selected period
    const newCustomersInPeriod = new Set(
      last30Days
        .filter(t => {
          const customerId = t.user_id;
          const customerData = customerPurchases[customerId];
          return customerData && customerData.firstPurchase >= thirtyDaysAgo;
        })
        .map(t => t.user_id)
    ).size;

    const returningCustomersInPeriod = customersCustomRange - newCustomersInPeriod;

    // Customer acquisition trend (monthly)
    const customerAcquisitionByMonth: Record<string, number> = {};
    for (let i = 11; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      customerAcquisitionByMonth[monthKey] = 0;
    }
    Object.values(customerPurchases).forEach(customer => {
      const monthKey = customer.firstPurchase.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });
      if (customerAcquisitionByMonth[monthKey] !== undefined) {
        customerAcquisitionByMonth[monthKey] += 1;
      }
    });

    // Spending tier distribution
    const spendingTiers = {
      budget: Object.values(customerPurchases).filter(c => c.total < 50).length,
      mid_range: Object.values(customerPurchases).filter(c => c.total >= 50 && c.total < 200).length,
      premium: Object.values(customerPurchases).filter(c => c.total >= 200 && c.total < 500).length,
      high_value: Object.values(customerPurchases).filter(c => c.total >= 500).length,
    };

    // Purchase frequency distribution
    const frequencyDistribution = {
      single: Object.values(customerPurchases).filter(c => c.count === 1).length,
      occasional: Object.values(customerPurchases).filter(c => c.count >= 2 && c.count <= 4).length,
      regular: Object.values(customerPurchases).filter(c => c.count >= 5 && c.count <= 10).length,
      frequent: Object.values(customerPurchases).filter(c => c.count > 10).length,
    };

    // Customer churn risk (haven't purchased in 60+ days but purchased before)
    const churnRiskCustomers = Object.entries(customerPurchases)
      .filter(([_, data]) => {
        const daysSinceLastPurchase = Math.floor((now.getTime() - data.lastPurchase.getTime()) / (24 * 60 * 60 * 1000));
        return daysSinceLastPurchase > 60 && data.count > 1;
      }).length;

    // ======= TOP CUSTOMERS =======
    const topCustomerEntries = Object.entries(customerPurchases)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10);

    // Fetch customer names from profiles table
    const topCustomerIds = topCustomerEntries.map(([userId]) => userId);
    const { data: customerProfiles } = await serviceClient
      .from('profiles')
      .select('id, full_name, email')
      .in('id', topCustomerIds);

    const profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
    (customerProfiles || []).forEach((profile: any) => {
      profilesMap[profile.id] = { full_name: profile.full_name, email: profile.email };
    });

    const topCustomers = topCustomerEntries.map(([userId, data]) => ({
      user_id: userId,
      customer_name: profilesMap[userId]?.full_name || profilesMap[userId]?.email || null,
      total_spent: data.total,
      purchase_count: data.count,
      avg_order_value: data.total / data.count,
      days_since_last_purchase: Math.floor((now.getTime() - data.lastPurchase.getTime()) / (24 * 60 * 60 * 1000))
    }));

    // ======= TRANSACTION PATTERNS =======
    // By day of week
    const dayOfWeekCounts: Record<string, { transactions: number; revenue: number }> = {
      'Sunday': { transactions: 0, revenue: 0 },
      'Monday': { transactions: 0, revenue: 0 },
      'Tuesday': { transactions: 0, revenue: 0 },
      'Wednesday': { transactions: 0, revenue: 0 },
      'Thursday': { transactions: 0, revenue: 0 },
      'Friday': { transactions: 0, revenue: 0 },
      'Saturday': { transactions: 0, revenue: 0 }
    };
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    transactions.forEach(t => {
      const day = days[new Date(t.created_at).getDay()];
      dayOfWeekCounts[day].transactions += 1;
      dayOfWeekCounts[day].revenue += Number(t.amount);
    });

    // By hour of day
    const hourOfDayCounts: Record<string, number> = {};
    for (let i = 0; i < 24; i++) {
      hourOfDayCounts[i.toString()] = 0;
    }
    transactions.forEach(t => {
      const hour = new Date(t.created_at).getHours().toString();
      hourOfDayCounts[hour] = (hourOfDayCounts[hour] || 0) + 1;
    });

    // Peak hours
    const peakHour = Object.entries(hourOfDayCounts)
      .sort((a, b) => b[1] - a[1])[0];
    const peakDay = Object.entries(dayOfWeekCounts)
      .sort((a, b) => b[1].transactions - a[1].transactions)[0];

    // ======= AI-POWERED INSIGHTS =======
    const aiInsights = [];
    
    // Revenue prediction based on trends
    const monthlyRevenueValues = Object.values(monthlyRevenue).map(m => m.revenue);
    const recentMonths = monthlyRevenueValues.slice(-3);
    const avgRecentRevenue = recentMonths.reduce((a, b) => a + b, 0) / recentMonths.length;
    const projectedNextMonth = avgRecentRevenue * (1 + (revenueGrowth / 100 / 3));
    
    aiInsights.push({
      type: 'prediction',
      title: 'Revenue Projection',
      description: `Based on your current trends, projected revenue for next month: $${projectedNextMonth.toFixed(2)}`,
      confidence: recentMonths.length >= 3 ? 'high' : 'medium',
      icon: 'trending'
    });

    // Customer behavior insight
    if (repeatPurchaseRate > 30) {
      aiInsights.push({
        type: 'positive',
        title: 'Strong Customer Loyalty',
        description: `Your ${repeatPurchaseRate.toFixed(1)}% repeat purchase rate indicates excellent customer retention. Consider launching a loyalty program to reward these customers.`,
        confidence: 'high',
        icon: 'heart'
      });
    } else if (repeatPurchaseRate < 15 && uniqueCustomers > 10) {
      aiInsights.push({
        type: 'warning',
        title: 'Customer Retention Opportunity',
        description: `Only ${repeatPurchaseRate.toFixed(1)}% of customers make repeat purchases. Implement follow-up campaigns and loyalty incentives to boost retention.`,
        confidence: 'high',
        icon: 'alert'
      });
    }

    // Transaction velocity insight
    if (velocityGrowth > 20) {
      aiInsights.push({
        type: 'positive',
        title: 'Accelerating Sales',
        description: `Transaction velocity is up ${velocityGrowth.toFixed(1)}%. Your business momentum is strong - maintain current strategies.`,
        confidence: 'high',
        icon: 'rocket'
      });
    } else if (velocityGrowth < -20) {
      aiInsights.push({
        type: 'warning',
        title: 'Declining Sales Velocity',
        description: `Transaction velocity has decreased by ${Math.abs(velocityGrowth).toFixed(1)}%. Consider promotional campaigns to stimulate demand.`,
        confidence: 'high',
        icon: 'alert'
      });
    }

    // Peak timing insight
    if (peakDay && peakHour) {
      aiInsights.push({
        type: 'insight',
        title: 'Optimal Business Hours',
        description: `Your peak sales occur on ${peakDay[0]}s around ${peakHour[0]}:00. Schedule promotions and ensure adequate staffing during these times.`,
        confidence: 'high',
        icon: 'clock'
      });
    }

    // Churn risk insight
    if (churnRiskCustomers > 0) {
      aiInsights.push({
        type: 'warning',
        title: 'Churn Risk Alert',
        description: `${churnRiskCustomers} repeat customers haven't purchased in 60+ days. Launch a win-back campaign with personalized offers.`,
        confidence: 'high',
        icon: 'alert'
      });
    }

    // AOV optimization
    if (avgTransactionValue < 75 && totalTransactions > 20) {
      aiInsights.push({
        type: 'opportunity',
        title: 'Average Order Value Opportunity',
        description: `Your average order of $${avgTransactionValue.toFixed(2)} is below industry average ($75). Consider bundling, upsells, or minimum order incentives.`,
        confidence: 'medium',
        icon: 'dollar'
      });
    }

    // Seasonal pattern detection
    const monthNames = Object.keys(monthlyRevenue);
    const monthValues = Object.values(monthlyRevenue);
    let maxMonthIdx = 0;
    let minMonthIdx = 0;
    monthValues.forEach((m, idx) => {
      if (m.revenue > monthValues[maxMonthIdx].revenue) maxMonthIdx = idx;
      if (m.revenue < monthValues[minMonthIdx].revenue) minMonthIdx = idx;
    });
    
    if (monthValues[maxMonthIdx].revenue > monthValues[minMonthIdx].revenue * 2) {
      aiInsights.push({
        type: 'insight',
        title: 'Seasonal Pattern Detected',
        description: `Your strongest month is ${monthValues[maxMonthIdx].month}. Plan inventory and marketing campaigns to capitalize on this seasonal trend.`,
        confidence: 'medium',
        icon: 'calendar'
      });
    }

    // ======= GROWTH OPPORTUNITIES =======
    const growthOpportunities = [];

    // Check for declining customers
    const inactiveCustomers = Object.entries(customerPurchases)
      .filter(([_, data]) => {
        const daysSinceLastPurchase = Math.floor((now.getTime() - data.lastPurchase.getTime()) / (24 * 60 * 60 * 1000));
        return daysSinceLastPurchase > 30 && data.count > 1;
      }).length;
    
    if (inactiveCustomers > 0) {
      growthOpportunities.push({
        type: 'customer_reactivation',
        title: 'Reactivate Dormant Customers',
        description: `${inactiveCustomers} repeat customers haven't purchased in 30+ days`,
        impact: 'high',
        action: 'Consider a targeted re-engagement campaign',
        potential_revenue: inactiveCustomers * avgTransactionValue
      });
    }

    // Check for low repeat purchase rate
    if (repeatPurchaseRate < 20 && uniqueCustomers > 10) {
      growthOpportunities.push({
        type: 'retention',
        title: 'Improve Customer Retention',
        description: `Only ${repeatPurchaseRate.toFixed(1)}% of customers make repeat purchases`,
        impact: 'high',
        action: 'Implement loyalty rewards or follow-up communications',
        potential_revenue: oneTimeBuyers * avgTransactionValue * 0.3
      });
    }

    // Check for growth trend
    if (revenueGrowth < 0) {
      growthOpportunities.push({
        type: 'revenue',
        title: 'Revenue Declining',
        description: `Revenue is down ${Math.abs(revenueGrowth).toFixed(1)}% vs previous period`,
        impact: 'critical',
        action: 'Review pricing, promotions, or customer feedback',
        potential_revenue: Math.abs(revenueCustomRange * revenueGrowth / 100)
      });
    } else if (revenueGrowth > 20) {
      growthOpportunities.push({
        type: 'momentum',
        title: 'Strong Growth Momentum',
        description: `Revenue is up ${revenueGrowth.toFixed(1)}% vs previous period`,
        impact: 'positive',
        action: 'Double down on current strategies',
        potential_revenue: 0
      });
    }

    // Check avg transaction value
    if (avgTransactionValue < 50 && totalTransactions > 20) {
      growthOpportunities.push({
        type: 'aov',
        title: 'Increase Average Order Value',
        description: `Average order is $${avgTransactionValue.toFixed(2)}`,
        impact: 'medium',
        action: 'Consider bundles, upsells, or minimum order incentives',
        potential_revenue: totalTransactions * 10
      });
    }

    // ======= COMPETITIVE BENCHMARKING (industry averages) =======
    const industryAvgAOV = 75;
    const industryAvgRepeatRate = 35;
    const industryAvgLTV = 250;
    const industryAvgMonthlyGrowth = 5;
    const industryAvgCustomerRetention = 40;

    const benchmarking = {
      your_avg_transaction: avgTransactionValue,
      industry_avg_transaction: industryAvgAOV,
      your_repeat_rate: repeatPurchaseRate,
      industry_avg_repeat_rate: industryAvgRepeatRate,
      your_ltv: avgLifetimeValue,
      industry_avg_ltv: industryAvgLTV,
      your_monthly_growth: revenueGrowth / 3,
      industry_avg_monthly_growth: industryAvgMonthlyGrowth,
      your_customer_retention: uniqueCustomers > 0 ? (returningCustomersInPeriod / customersCustomRange * 100) : 0,
      industry_avg_customer_retention: industryAvgCustomerRetention,
      transaction_value_vs_industry: ((avgTransactionValue / industryAvgAOV) * 100) - 100,
      repeat_rate_vs_industry: repeatPurchaseRate - industryAvgRepeatRate,
      ltv_vs_industry: ((avgLifetimeValue / industryAvgLTV) * 100) - 100,
      overall_performance_score: Math.min(100, Math.round(
        (Math.min(avgTransactionValue / industryAvgAOV, 1.5) * 25) +
        (Math.min(repeatPurchaseRate / industryAvgRepeatRate, 1.5) * 25) +
        (Math.min(avgLifetimeValue / industryAvgLTV, 1.5) * 25) +
        (revenueGrowth > 0 ? 25 : Math.max(0, 25 + revenueGrowth))
      ))
    };

    // ======= RETURN COMPREHENSIVE ANALYTICS =======
    return new Response(
      JSON.stringify({
        has_access: true,
        generated_at: new Date().toISOString(),
        date_range: {
          start: thirtyDaysAgo.toISOString(),
          end: now.toISOString(),
          days: daysDiff
        },
        analytics: {
          overview: {
            total_revenue: Number(totalRevenue.toFixed(2)),
            total_transactions: totalTransactions,
            unique_customers: uniqueCustomers,
            avg_transaction_value: Number(avgTransactionValue.toFixed(2)),
            total_rewards_given: totalRewards,
            merchant_since: merchant.created_at,
            business_type: merchant.business_type
          },
          period_comparison: {
            current_period: {
              revenue: Number(revenueCustomRange.toFixed(2)),
              transactions: transactionsCustomRange,
              customers: customersCustomRange
            },
            previous_period: {
              revenue: Number(revenuePrevPeriod.toFixed(2)),
              transactions: transactionsPrevPeriod,
              customers: customersPrevPeriod
            },
            growth: {
              revenue: Number(revenueGrowth.toFixed(2)),
              transactions: Number(transactionGrowth.toFixed(2)),
              customers: Number(customerGrowth.toFixed(2))
            }
          },
          transaction_velocity: {
            daily_transactions: Number(dailyTransactionVelocity.toFixed(2)),
            daily_revenue: Number(dailyRevenueVelocity.toFixed(2)),
            weekly_transactions: Number(weeklyTransactionVelocity.toFixed(2)),
            weekly_revenue: Number(weeklyRevenueVelocity.toFixed(2)),
            velocity_growth: Number(velocityGrowth.toFixed(2)),
            projected_monthly_revenue: Number((dailyRevenueVelocity * 30).toFixed(2)),
            projected_monthly_transactions: Math.round(dailyTransactionVelocity * 30)
          },
          revenue_trends: {
            daily: Object.values(revenueByDay),
            monthly: Object.values(monthlyRevenue)
          },
          customer_insights: {
            segments: {
              one_time_buyers: oneTimeBuyers,
              repeat_buyers: repeatBuyers,
              loyal_customers: loyalCustomers,
              vip_customers: vipCustomers
            },
            metrics: {
              avg_lifetime_value: Number(avgLifetimeValue.toFixed(2)),
              repeat_purchase_rate: Number(repeatPurchaseRate.toFixed(2)),
              avg_purchases_per_customer: uniqueCustomers > 0 ? Number((totalTransactions / uniqueCustomers).toFixed(2)) : 0
            },
            demographics: {
              new_customers: newCustomersInPeriod,
              returning_customers: returningCustomersInPeriod,
              churn_risk_customers: churnRiskCustomers,
              spending_tiers: spendingTiers,
              frequency_distribution: frequencyDistribution,
              acquisition_trend: Object.entries(customerAcquisitionByMonth).map(([month, count]) => ({
                month,
                new_customers: count
              }))
            },
            top_customers: topCustomers
          },
          transaction_patterns: {
            by_day_of_week: Object.entries(dayOfWeekCounts).map(([day, data]) => ({
              day,
              transactions: data.transactions,
              revenue: Number(data.revenue.toFixed(2))
            })),
            by_hour: Object.entries(hourOfDayCounts).map(([hour, count]) => ({
              hour: `${hour}:00`,
              transactions: count
            })),
            peak_day: peakDay ? peakDay[0] : 'N/A',
            peak_hour: peakHour ? `${peakHour[0]}:00` : 'N/A'
          },
          ai_insights: aiInsights,
          growth_opportunities: growthOpportunities,
          competitive_benchmarking: benchmarking
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in merchant-get-premium-analytics:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
