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

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
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

    // Check if merchant has premium analytics subscription
    const { data: subscription } = await supabaseClient
      .from('merchant_analytics_subscriptions')
      .select('*, merchant_analytics_products(*)')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .eq('merchant_analytics_products.name', 'Premium Analytics Dashboard')
      .gte('end_date', new Date().toISOString())
      .single();

    if (!subscription) {
      return new Response(
        JSON.stringify({ 
          has_access: false,
          message: 'Premium Analytics Dashboard subscription required'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get customer demographics
    const { data: demographics } = await supabaseClient
      .from('transactions')
      .select(`
        user_id,
        created_at,
        amount,
        profiles!transactions_user_id_fkey(full_name, email)
      `)
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false })
      .limit(1000);

    // Calculate customer metrics
    const totalCustomers = new Set(demographics?.map(t => t.user_id) || []).size;
    const transactionSum = demographics?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;
    const avgTransactionValue = transactionSum / (demographics?.length || 1);
    
    // Transaction velocity (transactions per day over last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const recentTransactions = demographics?.filter(t => 
      new Date(t.created_at) > thirtyDaysAgo
    ) || [];
    
    const transactionVelocity = recentTransactions.length / 30;

    // Group by day for chart
    const transactionsByDay: Record<string, number> = {};
    recentTransactions.forEach(t => {
      const day = new Date(t.created_at).toLocaleDateString();
      transactionsByDay[day] = (transactionsByDay[day] || 0) + 1;
    });

    // Get location data
    const { data: locationData } = await supabaseClient
      .from('transactions')
      .select('user_id')
      .eq('merchant_id', merchant.id);

    const uniqueLocations = new Set(locationData?.map(t => t.user_id) || []).size;

    // Competitive benchmarking (mock data - would need real competitor data)
    const benchmarking = {
      your_avg_transaction: avgTransactionValue,
      market_avg_transaction: avgTransactionValue * 1.15,
      your_customer_count: totalCustomers,
      market_avg_customers: Math.round(totalCustomers * 1.3),
      your_velocity: transactionVelocity,
      market_avg_velocity: transactionVelocity * 1.1
    };

    return new Response(
      JSON.stringify({
        has_access: true,
        analytics: {
          customer_demographics: {
            total_customers: totalCustomers,
            avg_transaction_value: Number(avgTransactionValue.toFixed(2)),
            unique_locations: uniqueLocations
          },
          transaction_velocity: {
            daily_avg: Number(transactionVelocity.toFixed(2)),
            total_last_30_days: recentTransactions.length,
            by_day: transactionsByDay
          },
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