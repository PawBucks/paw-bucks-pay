import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: {
        headers: { Authorization: authHeader },
      },
    });

    // Verify JWT and get user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    console.log('Fetching merchant analytics for user:', user.id);

    // Get merchant ID for the authenticated user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantError);
      return new Response(
        JSON.stringify({ error: 'Merchant profile not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('Fetching analytics for merchant:', merchant.id);

    // Call the enhanced analytics function
    const startTime = performance.now();
    
    const { data: analyticsData, error: analyticsError } = await supabase
      .rpc('get_merchant_analytics', { _merchant_id: merchant.id })
      .single();

    const queryTime = performance.now() - startTime;
    console.log(`Query performance: ${queryTime.toFixed(2)}ms`);

    if (analyticsError || !analyticsData) {
      console.error('Analytics query error:', analyticsError);
      return new Response(
        JSON.stringify({ error: 'Failed to fetch analytics' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    const analytics = analyticsData as {
      merchant_id: string;
      business_name: string;
      total_transactions: number;
      total_customers: number;
      total_earnings: number;
      total_cashback_paid: number;
      avg_transaction_amount: number;
      repayment_rate: number;
      remaining_balance: number;
      funding_deal_status: string | null;
      refunded_transactions: number;
      refunded_amount: number;
    };

    // Format response
    const response = {
      merchant_id: analytics.merchant_id,
      total_sales: parseFloat(String(analytics.total_earnings || 0)),
      total_cashback: parseFloat(String(analytics.total_cashback_paid || 0)),
      repayment_rate: parseFloat(String(analytics.repayment_rate || 0)),
      remaining_balance: parseFloat(String(analytics.remaining_balance || 0)),
      total_transactions: parseInt(String(analytics.total_transactions || 0)),
      total_customers: parseInt(String(analytics.total_customers || 0)),
      avg_transaction_amount: parseFloat(String(analytics.avg_transaction_amount || 0)),
      funding_deal_status: analytics.funding_deal_status || null,
      // Include refund information for transparency
      refunded_transactions: parseInt(String(analytics.refunded_transactions || 0)),
      refunded_amount: parseFloat(String(analytics.refunded_amount || 0)),
      query_time_ms: queryTime.toFixed(2)
    };

    console.log('Analytics response:', response);

    return new Response(
      JSON.stringify(response),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }, 
        status: 200 
      }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
