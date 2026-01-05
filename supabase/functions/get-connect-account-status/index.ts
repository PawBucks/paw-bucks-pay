import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
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
    // STEP 1: Validate Stripe API Key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    // STEP 2: Initialize Stripe client
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover',
    });

    // STEP 3: Authenticate the requesting user
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // STEP 4: Get the Stripe account ID from request (can come from merchantId or directly)
    const { accountId: directAccountId, merchantId, stripeAccountId } = await req.json();
    
    let accountId = directAccountId || stripeAccountId;
    let merchantName = '';
    let resolvedMerchantId = merchantId;
    let acceptsPawBucks = false;
    
    // If merchantId provided, look up the stripe_account_id
    if (merchantId && !accountId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: merchant, error: merchantError } = await supabaseAdmin
        .from('merchants')
        .select('stripe_account_id, business_name, accepts_pawbucks')
        .eq('id', merchantId)
        .single();
        
      if (merchantError || !merchant) {
        console.log('Merchant not found:', merchantId);
        return new Response(
          JSON.stringify({ error: 'Merchant not found' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
        );
      }
      
      accountId = merchant.stripe_account_id;
      merchantName = merchant.business_name;
      acceptsPawBucks = merchant.accepts_pawbucks || false;
    }
    
    // If stripeAccountId provided, look up merchant info
    if (stripeAccountId && !merchantId) {
      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('id, business_name, accepts_pawbucks')
        .eq('stripe_account_id', stripeAccountId)
        .single();
        
      if (merchant) {
        merchantName = merchant.business_name;
        resolvedMerchantId = merchant.id;
        acceptsPawBucks = merchant.accepts_pawbucks || false;
      }
    }
    
    if (!accountId) {
      console.log('No Stripe account ID found');
      return new Response(
        JSON.stringify({ accountId: null, merchantId: resolvedMerchantId, merchantName, acceptsPawBucks }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    console.log('Fetching account status for:', accountId);

    // STEP 5: Retrieve the full account object from Stripe
    // This contains all onboarding status information
    const account = await stripe.accounts.retrieve(accountId);

    // STEP 6: Extract key information about the account's status
    const accountStatus = {
      // Account ID
      id: account.id,
      
      // Whether charges are enabled (can accept payments)
      charges_enabled: account.charges_enabled,
      
      // Whether payouts are enabled (can receive money)
      payouts_enabled: account.payouts_enabled,
      
      // Details about what information is still needed
      requirements: {
        // Information that must be provided to enable charges
        currently_due: account.requirements?.currently_due || [],
        
        // Information that will be needed in the future
        eventually_due: account.requirements?.eventually_due || [],
        
        // Past due requirements that must be provided immediately
        past_due: account.requirements?.past_due || [],
        
        // Errors that prevented requirements from being validated
        errors: account.requirements?.errors || [],
      },
      
      // Overall onboarding status
      details_submitted: account.details_submitted,
      
      // Business information
      business_profile: {
        name: account.business_profile?.name,
        url: account.business_profile?.url,
        support_email: account.business_profile?.support_email,
      },
      
      // External accounts (bank accounts/cards for payouts)
      external_accounts_count: account.external_accounts?.data?.length || 0,
      
      // Metadata we stored when creating the account
      metadata: account.metadata,
    };

    console.log('Account status retrieved successfully');

    // STEP 7: Return the account status with merchant info
    return new Response(
      JSON.stringify({
        ...accountStatus,
        accountId: account.id,
        merchantId: resolvedMerchantId,
        merchantName,
        acceptsPawBucks,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error fetching account status:', errorMessage);
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});
