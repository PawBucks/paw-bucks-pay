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
      .rpc('get_merchant_analytics', { p_merchant_id: merchant.id })
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
      total_sales: number;
      transaction_count: number;
      total_customers: number;
      total_earnings: number;
      total_cashback: number;
      avg_transaction_amount: number;
      total_fees: number;
      refunded_transactions: number;
      refunded_amount: number;
    };

    // Format response - using the new accurate analytics columns
    const response = {
      merchant_id: merchant.id,
      total_sales: parseFloat(String(analytics.total_sales || 0)),
      total_cashback: parseFloat(String(analytics.total_cashback || 0)),
      total_earnings: parseFloat(String(analytics.total_earnings || 0)),
      // Platform fees - now accurately calculated only on Stripe portion, not PawBucks
      total_fees: parseFloat(String(analytics.total_fees || 0)),
      total_transactions: parseInt(String(analytics.transaction_count || 0)),
      total_customers: parseInt(String(analytics.total_customers || 0)),
      avg_transaction_amount: parseFloat(String(analytics.avg_transaction_amount || 0)),
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
