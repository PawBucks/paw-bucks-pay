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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );
    if (authError || !user) {
      throw new Error("Unauthorized");
    }

    // Get merchant
    const { data: merchant, error: merchantError } = await supabaseClient
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    // Check if merchant has access via service purchase (Customer Cohort Analysis)
    const { data: servicePurchase } = await supabaseClient
      .from('merchant_service_purchases')
      .select('*, merchant_market_services(name)')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .gte('expires_at', new Date().toISOString());

    const hasCohortService = servicePurchase?.some(
      (p: any) => p.merchant_market_services?.name?.toLowerCase().includes('cohort')
    );

    if (!hasCohortService) {
      return new Response(
        JSON.stringify({ 
          has_access: false,
          message: 'Customer Cohort Analysis service required. Purchase from the Merchant Market to access detailed customer insights.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Generating cohort report for merchant ${merchant.id}`);

    // Get all transactions for this merchant
    const { data: transactions, error: txError } = await supabaseClient
      .from('transactions')
      .select('user_id, amount, created_at')
      .eq('merchant_id', merchant.id)
      .eq('status', 'completed')
      .order('created_at', { ascending: true });

    if (txError) {
      console.error('Error fetching transactions:', txError);
      throw new Error('Failed to fetch transaction data');
    }

    // Build customer data
    interface CustomerData {
      first_purchase: string;
      last_purchase: string;
      total_spent: number;
      transaction_count: number;
      cohort_month: string;
      transactions: { amount: number; date: string }[];
    }

    const customerData: Record<string, CustomerData> = {};
    
    transactions?.forEach(t => {
      if (!customerData[t.user_id]) {
        customerData[t.user_id] = {
          first_purchase: t.created_at,
          last_purchase: t.created_at,
          total_spent: 0,
          transaction_count: 0,
          cohort_month: new Date(t.created_at).toISOString().slice(0, 7),
          transactions: []
        };
      }
      
      customerData[t.user_id].total_spent += Number(t.amount);
      customerData[t.user_id].transaction_count += 1;
      customerData[t.user_id].last_purchase = t.created_at;
      customerData[t.user_id].transactions.push({
        amount: Number(t.amount),
        date: t.created_at
      });
    });

    // Calculate metrics by cohort
    interface CohortMetrics {
      customer_count: number;
      total_ltv: number;
      total_aov: number;
      active_customers: number;
      total_revenue: number;
      total_transactions: number;
    }

    const cohorts: Record<string, CohortMetrics> = {};
    
    Object.values(customerData).forEach((customer) => {
      const cohort = customer.cohort_month;
      
      if (!cohorts[cohort]) {
        cohorts[cohort] = {
          customer_count: 0,
          total_ltv: 0,
          total_aov: 0,
          active_customers: 0,
          total_revenue: 0,
          total_transactions: 0
        };
      }
      
      cohorts[cohort].customer_count += 1;
      cohorts[cohort].total_ltv += customer.total_spent;
      cohorts[cohort].total_aov += customer.total_spent / customer.transaction_count;
      cohorts[cohort].total_revenue += customer.total_spent;
      cohorts[cohort].total_transactions += customer.transaction_count;
      
      // Check if customer is still active (purchased in last 60 days)
      const daysSinceLastPurchase = Math.floor(
        (Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastPurchase <= 60) {
        cohorts[cohort].active_customers += 1;
      }
    });

    // Calculate averages and create cohort breakdown
    const cohortAnalysis = Object.entries(cohorts).map(([month, data]) => ({
      cohort_month: month,
      customer_count: data.customer_count,
      avg_ltv: Number((data.total_ltv / data.customer_count).toFixed(2)),
      avg_aov: Number((data.total_aov / data.customer_count).toFixed(2)),
      retention_rate: Number(((data.active_customers / data.customer_count) * 100).toFixed(2)),
      total_revenue: Number(data.total_revenue.toFixed(2)),
      avg_transactions_per_customer: Number((data.total_transactions / data.customer_count).toFixed(2))
    }));

    // Customer segments
    const customerValues = Object.values(customerData);
    const segments = [
      {
        segment: 'VIP ($500+)',
        customers: customerValues.filter(c => c.total_spent >= 500)
      },
      {
        segment: 'High Value ($200-500)',
        customers: customerValues.filter(c => c.total_spent >= 200 && c.total_spent < 500)
      },
      {
        segment: 'Medium Value ($50-200)',
        customers: customerValues.filter(c => c.total_spent >= 50 && c.total_spent < 200)
      },
      {
        segment: 'Low Value (<$50)',
        customers: customerValues.filter(c => c.total_spent < 50)
      }
    ];

    const totalCustomers = customerValues.length;
    const customerSegments = segments.map(s => ({
      segment: s.segment,
      count: s.customers.length,
      total_value: Number(s.customers.reduce((sum, c) => sum + c.total_spent, 0).toFixed(2)),
      avg_value: s.customers.length > 0 
        ? Number((s.customers.reduce((sum, c) => sum + c.total_spent, 0) / s.customers.length).toFixed(2))
        : 0,
      percentage: totalCustomers > 0 ? Number(((s.customers.length / totalCustomers) * 100).toFixed(2)) : 0
    }));

    // Build retention matrix (last 6 cohorts with 6 months)
    const sortedCohorts = Object.keys(cohorts).sort().slice(-6);
    const retentionMatrix = sortedCohorts.map(cohortMonth => {
      const cohortCustomers = customerValues.filter(c => c.cohort_month === cohortMonth);
      const cohortStartDate = new Date(cohortMonth + '-01');
      
      const months: number[] = [];
      for (let m = 0; m < 6; m++) {
        const periodStart = new Date(cohortStartDate);
        periodStart.setMonth(periodStart.getMonth() + m);
        const periodEnd = new Date(periodStart);
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        
        const activeInPeriod = cohortCustomers.filter(c => 
          c.transactions.some(t => {
            const txDate = new Date(t.date);
            return txDate >= periodStart && txDate < periodEnd;
          })
        ).length;
        
        const retentionPct = cohortCustomers.length > 0 
          ? Math.round((activeInPeriod / cohortCustomers.length) * 100)
          : 0;
        months.push(retentionPct);
      }
      
      return {
        cohort: cohortMonth,
        months
      };
    });

    // Generate recommendations
    const recommendations: string[] = [];
    
    const totalLTV = customerValues.reduce((sum, c) => sum + c.total_spent, 0);
    const avgLTV = totalCustomers > 0 ? totalLTV / totalCustomers : 0;
    const activeCustomers = customerValues.filter(c => {
      const daysSince = Math.floor((Date.now() - new Date(c.last_purchase).getTime()) / (1000 * 60 * 60 * 24));
      return daysSince <= 60;
    }).length;
    const overallRetention = totalCustomers > 0 ? (activeCustomers / totalCustomers) * 100 : 0;

    if (overallRetention < 30) {
      recommendations.push("Your retention rate is below 30%. Consider implementing a loyalty program or post-purchase follow-ups to encourage repeat visits.");
    }
    if (avgLTV < 100) {
      recommendations.push("Average lifetime value is under $100. Focus on upselling and cross-selling to increase per-customer revenue.");
    }
    
    const vipPct = customerSegments.find(s => s.segment === 'VIP ($500+)')?.percentage || 0;
    if (vipPct < 5) {
      recommendations.push("Less than 5% of customers are VIPs. Create exclusive offers for high-spenders to grow this valuable segment.");
    }
    
    const lowValuePct = customerSegments.find(s => s.segment === 'Low Value (<$50)')?.percentage || 0;
    if (lowValuePct > 50) {
      recommendations.push("Over half of customers have spent less than $50. Launch re-engagement campaigns with special offers to activate these customers.");
    }
    
    const recentCohorts = cohortAnalysis.slice(-3);
    if (recentCohorts.length >= 2) {
      const older = recentCohorts[0];
      const newer = recentCohorts[recentCohorts.length - 1];
      if (newer.avg_ltv > older.avg_ltv * 1.2) {
        recommendations.push("Great news! Recent cohorts show 20%+ higher LTV. Your customer acquisition strategy is improving.");
      }
    }

    if (recommendations.length === 0) {
      recommendations.push("Your cohort metrics look healthy! Continue monitoring trends and focus on maintaining your strong customer relationships.");
    }

    // Calculate overall metrics
    const allAOVs = customerValues.map(c => c.total_spent / c.transaction_count);
    const avgAOV = allAOVs.length > 0 ? allAOVs.reduce((a, b) => a + b, 0) / allAOVs.length : 0;
    const avgTxPerCustomer = totalCustomers > 0 
      ? customerValues.reduce((sum, c) => sum + c.transaction_count, 0) / totalCustomers 
      : 0;

    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_customers: totalCustomers,
        avg_lifetime_value: Number(avgLTV.toFixed(2)),
        avg_order_value: Number(avgAOV.toFixed(2)),
        overall_retention_rate: Number(overallRetention.toFixed(2)),
        total_cohorts: Object.keys(cohorts).length,
        total_revenue: Number(totalLTV.toFixed(2)),
        avg_transactions_per_customer: Number(avgTxPerCustomer.toFixed(2))
      },
      cohort_breakdown: cohortAnalysis.sort((a, b) => b.cohort_month.localeCompare(a.cohort_month)),
      customer_segments: customerSegments,
      retention_matrix: retentionMatrix,
      recommendations
    };

    console.log(`Generated cohort report with ${totalCustomers} customers across ${Object.keys(cohorts).length} cohorts`);

    return new Response(
      JSON.stringify({
        has_access: true,
        report
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in merchant-generate-cohort-report:', error);
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
