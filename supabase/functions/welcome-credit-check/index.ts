import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIER_CONFIG: Record<string, { totalPb: number; upfrontPb: number; totalUsd: number; upfrontUsd: number; minFirstUsd: number }> = {
  series_a: { totalPb: 250000, upfrontPb: 20000, totalUsd: 250, upfrontUsd: 20, minFirstUsd: 40 },
  series_b: { totalPb: 150000, upfrontPb: 15000, totalUsd: 150, upfrontUsd: 15, minFirstUsd: 30 },
  series_c: { totalPb: 75000, upfrontPb: 15000, totalUsd: 75, upfrontUsd: 15, minFirstUsd: 30, monthlyUsd: 10 },
  standard: { totalPb: 50000, upfrontPb: 10000, totalUsd: 50, upfrontUsd: 10, minFirstUsd: 20 },
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

    // Check for pet fund ledger first (new system)
    const { data: ledger } = await supabaseAdmin
      .from('pet_fund_ledgers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (ledger) {
      const seriesTier = ledger.series_tier || 'series_a';
      const tierConfig = TIER_CONFIG[seriesTier] || TIER_CONFIG.standard;
      const now = new Date();

      // Get available (non-expired, non-used) releases
      const { data: releases } = await supabaseAdmin
        .from('pet_fund_releases')
        .select('*')
        .eq('ledger_id', ledger.id)
        .eq('status', 'released')
        .is('used_at', null)
        .order('month_number', { ascending: true });

      const availableReleases = releases?.filter(r =>
        !r.expires_at || new Date(r.expires_at) > now
      ) || [];

      const currentPhaseAmount = availableReleases.reduce((sum, r) => sum + r.amount, 0);
      const oldestRelease = availableReleases[0];
      const minimumTransactionCents = oldestRelease
        ? Number(oldestRelease.min_transaction_usd) * 100
        : tierConfig.minFirstUsd * 100;

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

      // Expiration info for the oldest available release
      const expiresAt = oldestRelease?.expires_at || null;
      const daysRemaining = expiresAt
        ? Math.max(0, Math.ceil((new Date(expiresAt).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
        : null;

      logStep("Pet Fund check complete", { seriesTier, currentPhaseAmount, availableCount: availableReleases.length });

      return new Response(JSON.stringify({
        hasCredit: currentPhaseAmount > 0,
        isEligible: true,
        status: ledger.status,
        promotionType: 'pet_fund',
        seriesTier,
        creditId: ledger.id,
        creditAmount: currentPhaseAmount,
        totalCreditAmount: ledger.total_amount,
        totalFundAmount: tierConfig.totalPb,
        currentPhaseAmount,
        currentPhase: 1,
        expiresAt,
        daysRemaining,
        merchantEligible,
        merchantName,
        minimumTransactionCents,
        spotsRemaining: null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Check for legacy welcome credit
    const { data: credit } = await supabaseAdmin
      .from('user_welcome_credits')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!credit) {
      // No credit - check eligibility
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

      // Determine which tier they'd get
      const { data: promoData } = await supabaseAdmin.rpc('get_active_promotion');
      const tier = promoData?.[0]?.series_tier ?? 'standard';
      const spotsRemaining = promoData?.[0]?.spots_remaining ?? null;
      const config = TIER_CONFIG[tier] || TIER_CONFIG.standard;

      return new Response(JSON.stringify({
        hasCredit: false,
        isEligible: true,
        canIssue: true,
        promotionType: 'pet_fund',
        seriesTier: tier,
        spotsRemaining,
        creditAmount: config.upfrontPb,
        totalFundAmount: config.totalPb,
        currentPhaseAmount: config.upfrontPb,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Handle legacy credit (existing users)
    const now = new Date();
    const expiresAt = new Date(credit.expires_at);
    const daysRemaining = Math.max(0, Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

    if (credit.status === 'used' || credit.status === 'expired' || credit.status === 'revoked' || expiresAt < now) {
      return new Response(
        JSON.stringify({ hasCredit: false, isEligible: false, status: credit.status }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const phase1Used = credit.phase_1_used ?? false;
    const phase2Unlocked = credit.phase_2_unlocked ?? false;
    let currentPhaseAmount = 0;
    if (!phase1Used) currentPhaseAmount = credit.phase_1_amount;
    else if (phase2Unlocked) currentPhaseAmount = credit.phase_2_amount;

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

    return new Response(JSON.stringify({
      hasCredit: currentPhaseAmount > 0,
      isEligible: true,
      status: 'active',
      promotionType: credit.promotion_type || 'welcome_credit',
      creditAmount: currentPhaseAmount,
      totalCreditAmount: credit.credit_amount,
      phase1Amount: credit.phase_1_amount,
      phase2Amount: credit.phase_2_amount,
      phase1Used,
      phase2Unlocked,
      currentPhase: !phase1Used ? 1 : 2,
      currentPhaseAmount,
      expiresAt: credit.expires_at,
      daysRemaining,
      merchantEligible,
      merchantName,
      minimumTransactionCents: !phase1Used ? 4000 : 2000,
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Error checking welcome credit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
