import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[MERCHANT-WELCOME-CREDIT-TOGGLE] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Get authenticated user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    logStep("User authenticated", { userId: user.id });

    const { merchantId, acceptsWelcomeCredit } = await req.json();

    if (typeof acceptsWelcomeCredit !== 'boolean') {
      throw new Error('acceptsWelcomeCredit must be a boolean');
    }

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user owns this merchant
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, user_id, business_name, accepts_welcome_credit')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found');
    }

    if (merchant.user_id !== user.id) {
      throw new Error('Not authorized to manage this merchant');
    }

    // Update the merchant's welcome credit acceptance
    const updateData: Record<string, unknown> = {
      accepts_welcome_credit: acceptsWelcomeCredit,
    };

    // Only set opted_in_at when first opting in
    if (acceptsWelcomeCredit && !merchant.accepts_welcome_credit) {
      updateData.welcome_credit_opted_in_at = new Date().toISOString();
    }

    const { error: updateError } = await supabaseAdmin
      .from('merchants')
      .update(updateData)
      .eq('id', merchantId);

    if (updateError) {
      console.error('Error updating merchant:', updateError);
      throw new Error('Failed to update welcome credit setting');
    }

    // Log analytics event
    await supabaseAdmin
      .from('welcome_credit_analytics')
      .insert({
        event_type: acceptsWelcomeCredit ? 'merchant_opted_in' : 'merchant_opted_out',
        merchant_id: merchantId,
        event_data: {
          business_name: merchant.business_name,
          previous_status: merchant.accepts_welcome_credit,
        },
      });

    logStep("Welcome credit setting updated", {
      merchantId,
      acceptsWelcomeCredit,
      businessName: merchant.business_name,
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: acceptsWelcomeCredit
          ? 'Now accepting Welcome Credit - New customers can use their $50 credit with you!'
          : 'No longer accepting Welcome Credit',
        acceptsWelcomeCredit,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error toggling welcome credit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
