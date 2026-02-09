import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[WELCOME-CREDIT-CHECK] ${step}`, details ? JSON.stringify(details) : "");
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

    const { merchantId } = await req.json();

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user's welcome credit
    const { data: credit, error: creditError } = await supabaseAdmin
      .from('user_welcome_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (creditError) {
      console.error('Error fetching welcome credit:', creditError);
      throw new Error('Failed to check welcome credit status');
    }

    // If no credit exists, check if user is eligible for one
    if (!credit) {
      // Check if user has any transactions (would make them ineligible)
      const { count: transactionCount } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (transactionCount && transactionCount > 0) {
        return new Response(
          JSON.stringify({
            hasCredit: false,
            isEligible: false,
            reason: 'Not eligible - existing transactions',
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // User is eligible for a welcome credit but doesn't have one yet
      return new Response(
        JSON.stringify({
          hasCredit: false,
          isEligible: true,
          canIssue: true,
          creditAmount: 50000,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check credit status
    const now = new Date();
    const expiresAt = new Date(credit.expires_at);
    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (credit.status === 'used') {
      return new Response(
        JSON.stringify({
          hasCredit: false,
          isEligible: false,
          status: 'used',
          usedAt: credit.used_at,
          usedWithMerchantId: credit.used_with_merchant_id,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (credit.status === 'expired' || expiresAt < now) {
      // Update status if needed
      if (credit.status !== 'expired') {
        await supabaseAdmin
          .from('user_welcome_credits')
          .update({ status: 'expired' })
          .eq('id', credit.id);
      }

      return new Response(
        JSON.stringify({
          hasCredit: false,
          isEligible: false,
          status: 'expired',
          expiredAt: credit.expires_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (credit.status === 'revoked') {
      return new Response(
        JSON.stringify({
          hasCredit: false,
          isEligible: false,
          status: 'revoked',
          reason: credit.revocation_reason,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credit is active - check merchant eligibility if merchantId provided
    let merchantEligible = null;
    let merchantName = null;

    if (merchantId) {
      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('business_name, accepts_pawbucks')
        .eq('id', merchantId)
        .single();

      if (merchant) {
        // Any merchant that accepts PawBucks automatically accepts Welcome Credit
        merchantEligible = merchant.accepts_pawbucks ?? false;
        merchantName = merchant.business_name;
      }
    }

    logStep("Credit check complete", {
      creditId: credit.id,
      amount: credit.credit_amount,
      daysRemaining,
      merchantEligible,
    });

    return new Response(
      JSON.stringify({
        hasCredit: true,
        isEligible: true,
        status: 'active',
        creditId: credit.id,
        creditAmount: credit.credit_amount,
        expiresAt: credit.expires_at,
        daysRemaining,
        merchantEligible,
        merchantName,
        minimumTransactionCents: 7500, // $75 minimum
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error checking welcome credit:', error);
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
