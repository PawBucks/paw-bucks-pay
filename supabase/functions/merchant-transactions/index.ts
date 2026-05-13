import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://esm.sh/zod@3.22.4";

// Query parameters validation schema
const querySchema = z.object({
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  end_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  status: z.enum(['completed', 'pending', 'refunded', 'partially_refunded', 'all']).optional(),
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

    // Parse and validate request body
    let requestBody = {};
    try {
      const text = await req.text();
      if (text) {
        requestBody = JSON.parse(text);
      }
    } catch (e) {
      console.log('No body or invalid JSON, using defaults');
    }

    const validationResult = querySchema.safeParse(requestBody);
    if (!validationResult.success) {
      console.error('Invalid request parameters:', validationResult.error);
      return new Response(
        JSON.stringify({ error: 'Invalid request parameters' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { start_date: startDate, end_date: endDate, status, search } = validationResult.data;

    // Build query - fetch transactions, then fetch profiles separately for efficiency
    let query = supabase
      .from('transactions')
      .select(`
        id,
        created_at,
        amount,
        cashback_earned,
        application_fee,
        status,
        description,
        stripe_payment_intent_id,
        user_id,
        payment_method,
        amount_refunded
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
    } else {
      // By default, exclude failed transactions — they should never appear in merchant views
      query = query.neq('status', 'failed');
    }

    const { data: transactions, error: transactionsError } = await query;

    if (transactionsError) {
      throw transactionsError;
    }

    console.log(`Found ${transactions?.length || 0} transactions`);

    // Get unique user IDs from transactions
    const userIds = [...new Set((transactions || []).map((t: any) => t.user_id).filter(Boolean))];
    
    // Fetch profiles for those user IDs separately
    let profilesMap: Record<string, { full_name: string | null; email: string | null }> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .in('id', userIds);
      
      profilesMap = (profilesData || []).reduce((acc: any, profile: any) => {
        acc[profile.id] = { full_name: profile.full_name, email: profile.email };
        return acc;
      }, {});
    }

    // Get funding deal info for repayment calculations
    const { data: fundingDeal } = await supabase
      .from('funding_deals')
      .select('repayment_rate, amount_funded, total_repaid')
      .eq('merchant_id', merchant.id)
      .eq('status', 'active')
      .maybeSingle();

    const repaymentRate = fundingDeal?.repayment_rate || 0;

    // Format transactions with profile data
    // Net Payout = Total Amount - Platform Fee (application_fee) - Funding Repayment
    // Note: cashback_earned is in PawBucks (rewards given to customer) - merchants don't pay this
    const formattedTransactions = transactions?.map((t: any) => {
      const amount = parseFloat(t.amount || 0);
      const platformFee = parseFloat(t.application_fee || 0); // 3% fee on Stripe portion
      const cashbackGivenPawBucks = parseFloat(t.cashback_earned || 0); // In PawBucks, for display
      const repaymentDeducted = (amount * repaymentRate) / 100;
      
      // Net payout = amount - platform fee - funding repayment
      const netPayout = amount - platformFee - repaymentDeducted;
      const profile = t.user_id ? profilesMap[t.user_id] : null;
      
      // Format payment method for display
      const formatPaymentMethod = (method: string | null): string => {
        if (!method) return 'Card';
        // Map payment method values to display labels
        const methodMap: Record<string, string> = {
          'card': 'Card',
          'credit_card': 'Credit Card',
          'cash': 'Cash',
          'check': 'Check',
          'bank_transfer': 'Bank Transfer',
          'venmo': 'Venmo',
          'paypal': 'PayPal',
          'zelle': 'Zelle',
          'other': 'Other',
        };
        return methodMap[method] || method.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
      };

      return {
        transaction_id: t.id,
        date: t.created_at,
        customer_name: profile?.full_name || 'Unknown',
        customer_email: profile?.email || '',
        amount: amount,
        amount_refunded: parseFloat(t.amount_refunded || 0),
        cashback_given: cashbackGivenPawBucks, // PawBucks given to customer (for display only)
        platform_fee: platformFee, // Platform's 3% fee
        repayment_deducted: repaymentDeducted,
        net_payout: netPayout,
        payment_method: formatPaymentMethod(t.payment_method),
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
