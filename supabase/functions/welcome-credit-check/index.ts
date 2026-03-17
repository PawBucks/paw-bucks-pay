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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    logStep("User authenticated", { userId: user.id });

    const { merchantId } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: credit, error: creditError } = await supabaseAdmin
      .from('user_welcome_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (creditError) {
      console.error('Error fetching welcome credit:', creditError);
      throw new Error('Failed to check welcome credit status');
    }

    // No credit exists - check eligibility and determine which promotion they'd get
    if (!credit) {
      const { count: transactionCount } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id);

      if (transactionCount && transactionCount > 0) {
        return new Response(
          JSON.stringify({ hasCredit: false, isEligible: false, reason: 'Not eligible - existing transactions' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      // Check which promotion type they'd receive
      const { data: promoData } = await supabaseAdmin.rpc('get_active_promotion');
      const promotionType = promoData?.[0]?.promotion_type ?? 'welcome_credit';
      const spotsRemaining = promoData?.[0]?.spots_remaining ?? 0;

      if (promotionType === 'pet_fund') {
        return new Response(
          JSON.stringify({
            hasCredit: false,
            isEligible: true,
            canIssue: true,
            promotionType: 'pet_fund',
            spotsRemaining,
            creditAmount: 20000,
            totalFundAmount: 250000,
            phase1Amount: 20000,
            phase2Amount: 230000,
            phase1Used: false,
            phase2Unlocked: false,
            currentPhaseAmount: 20000,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      } else {
        return new Response(
          JSON.stringify({
            hasCredit: false,
            isEligible: true,
            canIssue: true,
            promotionType: 'welcome_credit',
            creditAmount: 50000,
            totalFundAmount: 50000,
            phase1Amount: 50000,
            phase2Amount: 0,
            phase1Used: false,
            phase2Unlocked: true,
            currentPhaseAmount: 50000,
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check credit status
    const now = new Date();
    const expiresAt = new Date(credit.expires_at);
    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
    const promotionType = credit.promotion_type || 'pet_fund';

    if (credit.status === 'used') {
      return new Response(
        JSON.stringify({ hasCredit: false, isEligible: false, status: 'used', promotionType, usedAt: credit.used_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (credit.status === 'expired' || expiresAt < now) {
      if (credit.status !== 'expired') {
        await supabaseAdmin.from('user_welcome_credits').update({ status: 'expired' }).eq('id', credit.id);
      }
      return new Response(
        JSON.stringify({ hasCredit: false, isEligible: false, status: 'expired', promotionType, expiredAt: credit.expires_at }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (credit.status === 'revoked') {
      return new Response(
        JSON.stringify({ hasCredit: false, isEligible: false, status: 'revoked', promotionType, reason: credit.revocation_reason }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Credit is active
    const phase1Used = credit.phase_1_used ?? false;
    const phase2Unlocked = credit.phase_2_unlocked ?? false;

    let currentPhaseAmount = 0;
    let currentPhase = 0;

    if (promotionType === 'welcome_credit') {
      // Welcome Credit: all 50k available immediately
      currentPhaseAmount = credit.credit_amount;
      currentPhase = 1;
    } else {
      // Pet Fund: phase-based
      if (!phase1Used) {
        currentPhaseAmount = credit.phase_1_amount;
        currentPhase = 1;
      } else if (phase2Unlocked) {
        currentPhaseAmount = credit.phase_2_amount;
        currentPhase = 2;
      }
    }

    // Check merchant eligibility
    let merchantEligible = null;
    let merchantName = null;
    if (merchantId) {
      const { data: merchant } = await supabaseAdmin
        .from('merchants')
        .select('business_name, accepts_pawbucks')
        .eq('id', merchantId)
        .single();
      if (merchant) {
        merchantEligible = merchant.accepts_pawbucks ?? false;
        merchantName = merchant.business_name;
      }
    }

    // Minimum transaction: Pet Fund month 0 = $40, otherwise $20; Welcome Credit = $20
    const minimumTransactionCents = promotionType === 'pet_fund' && !phase1Used ? 4000 : promotionType === 'welcome_credit' ? 7500 : 2000;

    logStep("Credit check complete", { creditId: credit.id, promotionType, currentPhase, currentPhaseAmount, daysRemaining });

    return new Response(
      JSON.stringify({
        hasCredit: currentPhaseAmount > 0,
        isEligible: true,
        status: 'active',
        promotionType,
        creditId: credit.id,
        creditAmount: currentPhaseAmount,
        totalCreditAmount: credit.credit_amount,
        phase1Amount: credit.phase_1_amount,
        phase2Amount: credit.phase_2_amount,
        phase1Used,
        phase1UsedAt: credit.phase_1_used_at,
        phase2Unlocked,
        phase2UnlockedAt: credit.phase_2_unlocked_at,
        currentPhase,
        currentPhaseAmount,
        expiresAt: credit.expires_at,
        daysRemaining,
        merchantEligible,
        merchantName,
        minimumTransactionCents,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error checking welcome credit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
