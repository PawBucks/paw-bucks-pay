import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
      .select('id, business_name, cashback_rate, created_at')
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
      .order('created_at', { ascending: false });

    const transactions = allTransactions || [];
    
    // Time periods
    const now = new Date();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
    const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const oneYearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);

    // Filter by time periods
    const last30Days = transactions.filter(t => new Date(t.created_at) > thirtyDaysAgo);
    const prev30Days = transactions.filter(t => 
      new Date(t.created_at) > sixtyDaysAgo && new Date(t.created_at) <= thirtyDaysAgo
    );
    const last90Days = transactions.filter(t => new Date(t.created_at) > ninetyDaysAgo);
    const lastYear = transactions.filter(t => new Date(t.created_at) > oneYearAgo);

    // ======= KEY METRICS =======
    const totalRevenue = transactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const totalRewards = transactions.reduce((sum, t) => sum + Number(t.rewards_earned), 0);
    const totalTransactions = transactions.length;
    const uniqueCustomers = new Set(transactions.map(t => t.user_id)).size;
    const avgTransactionValue = totalTransactions > 0 ? totalRevenue / totalTransactions : 0;

    // Last 30 days metrics
    const revenue30Days = last30Days.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactions30Days = last30Days.length;
    const customers30Days = new Set(last30Days.map(t => t.user_id)).size;

    // Previous 30 days for comparison
    const revenuePrev30Days = prev30Days.reduce((sum, t) => sum + Number(t.amount), 0);
    const transactionsPrev30Days = prev30Days.length;
    const customersPrev30Days = new Set(prev30Days.map(t => t.user_id)).size;

    // Growth rates
    const revenueGrowth = revenuePrev30Days > 0 
      ? ((revenue30Days - revenuePrev30Days) / revenuePrev30Days) * 100 
      : 0;
    const transactionGrowth = transactionsPrev30Days > 0 
      ? ((transactions30Days - transactionsPrev30Days) / transactionsPrev30Days) * 100 
      : 0;
    const customerGrowth = customersPrev30Days > 0 
      ? ((customers30Days - customersPrev30Days) / customersPrev30Days) * 100 
      : 0;

    // ======= REVENUE TRENDS (Daily for last 30 days) =======
    const revenueByDay: Record<string, { revenue: number; transactions: number; date: string }> = {};
    for (let i = 29; i >= 0; i--) {
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
    const customerPurchases: Record<string, { count: number; total: number; firstPurchase: Date; lastPurchase: Date }> = {};
    transactions.forEach(t => {
      const userId = t.user_id;
      const amount = Number(t.amount);
      const date = new Date(t.created_at);
      
      if (!customerPurchases[userId]) {
        customerPurchases[userId] = { count: 0, total: 0, firstPurchase: date, lastPurchase: date };
      }
      customerPurchases[userId].count += 1;
      customerPurchases[userId].total += amount;
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

    // ======= TOP CUSTOMERS =======
    const topCustomers = Object.entries(customerPurchases)
      .sort((a, b) => b[1].total - a[1].total)
      .slice(0, 10)
      .map(([userId, data]) => ({
        user_id: userId,
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
        action: 'Consider a targeted re-engagement campaign'
      });
    }

    // Check for low repeat purchase rate
    if (repeatPurchaseRate < 20 && uniqueCustomers > 10) {
      growthOpportunities.push({
        type: 'retention',
        title: 'Improve Customer Retention',
        description: `Only ${repeatPurchaseRate.toFixed(1)}% of customers make repeat purchases`,
        impact: 'high',
        action: 'Implement loyalty rewards or follow-up communications'
      });
    }

    // Check for growth trend
    if (revenueGrowth < 0) {
      growthOpportunities.push({
        type: 'revenue',
        title: 'Revenue Declining',
        description: `Revenue is down ${Math.abs(revenueGrowth).toFixed(1)}% vs previous 30 days`,
        impact: 'critical',
        action: 'Review pricing, promotions, or customer feedback'
      });
    } else if (revenueGrowth > 20) {
      growthOpportunities.push({
        type: 'momentum',
        title: 'Strong Growth Momentum',
        description: `Revenue is up ${revenueGrowth.toFixed(1)}% vs previous 30 days`,
        impact: 'positive',
        action: 'Double down on current strategies'
      });
    }

    // Check avg transaction value
    if (avgTransactionValue < 50 && totalTransactions > 20) {
      growthOpportunities.push({
        type: 'aov',
        title: 'Increase Average Order Value',
        description: `Average order is $${avgTransactionValue.toFixed(2)}`,
        impact: 'medium',
        action: 'Consider bundles, upsells, or minimum order incentives'
      });
    }

    // ======= COMPETITIVE BENCHMARKING (industry averages) =======
    const industryAvgAOV = 75; // Typical pet services
    const industryAvgRepeatRate = 35;
    const industryAvgLTV = 250;

    const benchmarking = {
      your_avg_transaction: avgTransactionValue,
      industry_avg_transaction: industryAvgAOV,
      your_repeat_rate: repeatPurchaseRate,
      industry_avg_repeat_rate: industryAvgRepeatRate,
      your_ltv: avgLifetimeValue,
      industry_avg_ltv: industryAvgLTV,
      transaction_value_vs_industry: ((avgTransactionValue / industryAvgAOV) * 100) - 100,
      repeat_rate_vs_industry: repeatPurchaseRate - industryAvgRepeatRate,
      ltv_vs_industry: ((avgLifetimeValue / industryAvgLTV) * 100) - 100
    };

    // ======= RETURN COMPREHENSIVE ANALYTICS =======
    return new Response(
      JSON.stringify({
        has_access: true,
        analytics: {
          overview: {
            total_revenue: Number(totalRevenue.toFixed(2)),
            total_transactions: totalTransactions,
            unique_customers: uniqueCustomers,
            avg_transaction_value: Number(avgTransactionValue.toFixed(2)),
            total_rewards_given: totalRewards,
            merchant_since: merchant.created_at
          },
          period_comparison: {
            current_period: {
              revenue: Number(revenue30Days.toFixed(2)),
              transactions: transactions30Days,
              customers: customers30Days
            },
            previous_period: {
              revenue: Number(revenuePrev30Days.toFixed(2)),
              transactions: transactionsPrev30Days,
              customers: customersPrev30Days
            },
            growth: {
              revenue: Number(revenueGrowth.toFixed(2)),
              transactions: Number(transactionGrowth.toFixed(2)),
              customers: Number(customerGrowth.toFixed(2))
            }
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
