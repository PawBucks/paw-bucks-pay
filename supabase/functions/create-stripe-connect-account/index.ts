import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    // TODO: Set STRIPE_SECRET_KEY in your Supabase secrets
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured. Please add it to your Supabase secrets.');
    }

    // STEP 2: Initialize Stripe with the latest API version
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-10-29.clover', // Latest API version
    });

    // STEP 3: Authenticate the user making the request
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header provided');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    // STEP 4: Get merchant information from request
    const { merchantId } = await req.json();

    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    console.log('Creating Stripe Connect account for merchant:', merchantId);

    // STEP 5: Initialize Supabase admin client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // STEP 6: Retrieve merchant details and verify ownership
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('*, profiles!inner(*)')
      .eq('id', merchantId)
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found or access denied');
    }

    // STEP 7: Check if Stripe Connect account already exists
    if (merchant.stripe_account_id) {
      console.log('Account already exists, creating new onboarding link');
      
      // Create a new account link for existing account to re-onboard
      const accountLink = await stripe.accountLinks.create({
        account: merchant.stripe_account_id,
        refresh_url: `${req.headers.get('origin')}/merchant-dashboard?refresh=true`,
        return_url: `${req.headers.get('origin')}/merchant-dashboard?success=true`,
        type: 'account_onboarding',
      });

      return new Response(
        JSON.stringify({
          accountId: merchant.stripe_account_id,
          onboardingUrl: accountLink.url,
          isExisting: true,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // STEP 8: Create new Stripe Connect account using CONTROLLER properties
    // IMPORTANT: Do NOT use top-level 'type' property (no type: 'express', 'standard', or 'custom')
    // Instead, use the controller object to define the account behavior
    const account = await stripe.accounts.create({
      // Use merchant's email from their profile
      email: merchant.profiles.email,
      
      // Define the business details
      business_type: 'company',
      company: {
        name: merchant.business_name,
      },
      
      // CRITICAL: Use controller properties to define account behavior
      controller: {
        // Platform controls fee collection - connected account pays Stripe fees
        fees: {
          payer: 'account' as const, // Connected account pays their own Stripe fees
        },
        // Stripe handles payment disputes and losses (not the platform)
        losses: {
          payments: 'stripe' as const, // Stripe covers payment losses/disputes
        },
        // Connected account gets full access to their Stripe dashboard
        stripe_dashboard: {
          type: 'full' as const, // Full dashboard access for the merchant
        }
      },
      
      // Request payment capabilities for the account
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      
      // Store metadata for tracking
      metadata: {
        merchant_id: merchantId,
        user_id: user.id,
      },
    });

    console.log('Stripe Connect account created:', account.id);

    // STEP 9: Update merchant record with Stripe account ID
    const { error: updateError } = await supabaseAdmin
      .from('merchants')
      .update({
        stripe_account_id: account.id,
        stripe_account_status: 'pending', // Account created but not yet onboarded
      })
      .eq('id', merchantId);

    if (updateError) {
      console.error('Error updating merchant:', updateError);
      throw updateError;
    }

    // STEP 10: Create account link for onboarding flow
    // This redirects the merchant to Stripe's onboarding process
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      // URL to redirect if link expires or user clicks "refresh"
      refresh_url: `${req.headers.get('origin')}/merchant-dashboard?refresh=true`,
      // URL to redirect after successful onboarding
      return_url: `${req.headers.get('origin')}/merchant-dashboard?success=true`,
      type: 'account_onboarding',
    });

    console.log('Account link created successfully');

    // STEP 11: Return the onboarding URL to redirect the merchant
    return new Response(
      JSON.stringify({
        accountId: account.id,
        onboardingUrl: accountLink.url,
        isExisting: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error creating Stripe Connect account:', errorMessage);
    
    // Provide user-friendly error messages
    let userMessage = errorMessage;
    if (errorMessage.includes('STRIPE_SECRET_KEY')) {
      userMessage = 'Stripe is not configured. Please contact support.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        success: false,
        originalError: errorMessage 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  }
});
