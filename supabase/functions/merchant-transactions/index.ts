import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

// Query parameters validation schema
const querySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['completed', 'pending', 'refunded', 'all']).optional(),
  search: z.string().max(100).optional(),
});

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

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('Fetching transactions for user:', user.id);

    // Get merchant ID from user
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found for user:', user.id, merchantError);
      throw new Error('Unable to fetch transactions. Please try again.');
    }

    console.log('Found merchant:', merchant.id);

    // Parse and validate query parameters
    const url = new URL(req.url);
    const queryParams = {
      start_date: url.searchParams.get('start_date'),
      end_date: url.searchParams.get('end_date'),
      status: url.searchParams.get('status'),
      search: url.searchParams.get('search'),
    };

    const validationResult = querySchema.safeParse(queryParams);
    if (!validationResult.success) {
      console.error('Invalid query parameters:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid query parameters' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { start_date: startDate, end_date: endDate, status, search } = validationResult.data;

    // Build query
    let query = supabase
      .from('transactions')
      .select(`
        id,
        created_at,
        amount,
        cashback_earned,
        status,
        description,
        stripe_payment_intent_id,
        user_id,
        profiles!transactions_user_id_fkey(full_name, email)
      `)
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });

    // Apply filters
    if (startDate) {
      query = query.gte('created_at', startDate);
    }
    if (endDate) {
      query = query.lte('created_at', endDate);
    }
    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    const { data: transactions, error: transactionsError } = await query;

    if (transactionsError) {
      throw transactionsError;
    }

    console.log(`Found ${transactions?.length || 0} transactions`);

    // Get funding deal info for repayment calculations
    const { data: fundingDeal } = await supabase
      .from('funding_deals')
      .select('repayment_rate, amount_funded, total_repaid')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .maybeSingle();

    const repaymentRate = fundingDeal?.repayment_rate || 0;

    // Format transactions
    const formattedTransactions = transactions?.map((t: any) => {
      const amount = parseFloat(t.amount || 0);
      const cashbackGiven = parseFloat(t.cashback_earned || 0);
      const repaymentDeducted = (amount * repaymentRate) / 100;
      const netPayout = amount - cashbackGiven - repaymentDeducted;

      return {
        transaction_id: t.id,
        date: t.created_at,
        customer_name: t.profiles?.full_name || 'Unknown',
        customer_email: t.profiles?.email || '',
        amount: amount,
        cashback_given: cashbackGiven,
        repayment_deducted: repaymentDeducted,
        net_payout: netPayout,
        payment_method: 'Card', // Default - could be expanded with Stripe data
        status: t.status,
        description: t.description || '',
      };
    }) || [];

    // Apply search filter if provided
    let filteredTransactions = formattedTransactions;
    if (search) {
      const searchLower = search.toLowerCase();
      filteredTransactions = formattedTransactions.filter((t: any) =>
        t.customer_name.toLowerCase().includes(searchLower) ||
        t.customer_email.toLowerCase().includes(searchLower) ||
        t.transaction_id.toLowerCase().includes(searchLower)
      );
    }

    return new Response(
      JSON.stringify({ 
        transactions: filteredTransactions,
        total_count: filteredTransactions.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('Error in merchant-transactions function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch transactions';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
