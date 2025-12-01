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

    // Check if merchant purchased this report
    const { data: purchase } = await supabaseClient
      .from('merchant_analytics_purchases')
      .select('*, merchant_analytics_products(*)')
      .eq('merchant_id', merchant.id)
      .eq('merchant_analytics_products.name', 'Customer Cohort Analysis Report')
      .order('purchase_date', { ascending: false })
      .limit(1)
      .single();

    if (!purchase) {
      return new Response(
        JSON.stringify({ 
          has_access: false,
          message: 'Customer Cohort Analysis Report purchase required'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get all transactions for this merchant
    const { data: transactions } = await supabaseClient
      .from('transactions')
      .select('user_id, amount, created_at')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: true });

    // Build cohort data
    const customerData: Record<string, any> = {};
    
    transactions?.forEach(t => {
      if (!customerData[t.user_id]) {
        customerData[t.user_id] = {
          first_purchase: t.created_at,
          last_purchase: t.created_at,
          total_spent: 0,
          transaction_count: 0,
          cohort_month: new Date(t.created_at).toISOString().slice(0, 7)
        };
      }
      
      customerData[t.user_id].total_spent += Number(t.amount);
      customerData[t.user_id].transaction_count += 1;
      customerData[t.user_id].last_purchase = t.created_at;
    });

    // Calculate metrics by cohort
    const cohorts: Record<string, any> = {};
    
    Object.values(customerData).forEach((customer: any) => {
      const cohort = customer.cohort_month;
      
      if (!cohorts[cohort]) {
        cohorts[cohort] = {
          customer_count: 0,
          total_ltv: 0,
          total_aov: 0,
          active_customers: 0
        };
      }
      
      cohorts[cohort].customer_count += 1;
      cohorts[cohort].total_ltv += customer.total_spent;
      cohorts[cohort].total_aov += customer.total_spent / customer.transaction_count;
      
      // Check if customer is still active (purchased in last 60 days)
      const daysSinceLastPurchase = Math.floor(
        (Date.now() - new Date(customer.last_purchase).getTime()) / (1000 * 60 * 60 * 24)
      );
      if (daysSinceLastPurchase <= 60) {
        cohorts[cohort].active_customers += 1;
      }
    });

    // Calculate averages and retention
    const cohortAnalysis = Object.entries(cohorts).map(([month, data]: [string, any]) => ({
      cohort_month: month,
      customer_count: data.customer_count,
      avg_ltv: Number((data.total_ltv / data.customer_count).toFixed(2)),
      avg_aov: Number((data.total_aov / data.customer_count).toFixed(2)),
      retention_rate: Number(((data.active_customers / data.customer_count) * 100).toFixed(2))
    }));

    // Overall metrics
    const totalCustomers = Object.keys(customerData).length;
    const totalLTV = Object.values(customerData).reduce((sum: number, c: any) => sum + c.total_spent, 0);
    const avgLTV = totalLTV / totalCustomers;
    
    const allAOVs = Object.values(customerData).map((c: any) => c.total_spent / c.transaction_count);
    const avgAOV = allAOVs.reduce((a, b) => a + b, 0) / allAOVs.length;

    const report = {
      generated_at: new Date().toISOString(),
      summary: {
        total_customers: totalCustomers,
        avg_lifetime_value: Number(avgLTV.toFixed(2)),
        avg_order_value: Number(avgAOV.toFixed(2)),
        total_cohorts: Object.keys(cohorts).length
      },
      cohort_breakdown: cohortAnalysis.sort((a, b) => b.cohort_month.localeCompare(a.cohort_month))
    };

    // Save report to purchase record
    await supabaseClient
      .from('merchant_analytics_purchases')
      .update({ report_data: report })
      .eq('id', purchase.id);

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