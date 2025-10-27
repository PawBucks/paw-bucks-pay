import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    // Get authenticated user
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

    const { merchantId } = await req.json();

    if (!merchantId) {
      throw new Error('Missing merchantId');
    }

    console.log('Creating Stripe Connect account for merchant:', merchantId);

    // Initialize Supabase admin client
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get merchant details and verify ownership
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('*, profiles!inner(*)')
      .eq('id', merchantId)
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found or access denied');
    }

    // Check if account already exists
    if (merchant.stripe_account_id) {
      console.log('Account already exists, creating new onboarding link');
      
      // Create a new account link for existing account
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

    // Create new Stripe Connect Express account
    const account = await stripe.accounts.create({
      type: 'express',
      email: merchant.profiles.email,
      business_type: 'company',
      company: {
        name: merchant.business_name,
      },
      capabilities: {
        card_payments: { requested: true },
        transfers: { requested: true },
      },
      metadata: {
        merchant_id: merchantId,
        user_id: user.id,
      },
    });

    console.log('Stripe Connect account created:', account.id);

    // Update merchant with Stripe account ID
    const { error: updateError } = await supabaseAdmin
      .from('merchants')
      .update({
        stripe_account_id: account.id,
        stripe_account_status: 'pending',
      })
      .eq('id', merchantId);

    if (updateError) {
      console.error('Error updating merchant:', updateError);
      throw updateError;
    }

    // Create account link for onboarding
    const accountLink = await stripe.accountLinks.create({
      account: account.id,
      refresh_url: `${req.headers.get('origin')}/merchant-dashboard?refresh=true`,
      return_url: `${req.headers.get('origin')}/merchant-dashboard?success=true`,
      type: 'account_onboarding',
    });

    console.log('Account link created successfully');

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
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
