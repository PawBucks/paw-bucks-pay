import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const TIER_CONFIG: Record<string, { totalPb: number; upfrontPb: number; label: string }> = {
  series_a: { totalPb: 250000, upfrontPb: 20000, label: 'Series A ($250)' },
  series_b: { totalPb: 150000, upfrontPb: 15000, label: 'Series B ($150)' },
  series_c: { totalPb: 75000, upfrontPb: 15000, label: 'Series C ($75)' },
  standard: { totalPb: 50000, upfrontPb: 10000, label: 'Standard ($50)' },
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[WELCOME-CREDIT-ISSUE] ${step}`, details ? JSON.stringify(details) : "");
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

    const { deviceFingerprint, ipAddress } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already has a Pet Fund ledger
    const { data: existingLedger } = await supabaseAdmin
      .from('pet_fund_ledgers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLedger) {
      logStep("User already has Pet Fund", { ledgerId: existingLedger.id });
      return new Response(
        JSON.stringify({ success: false, message: 'Pet Fund already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user already has legacy credit
    const { data: existingCredit } = await supabaseAdmin
      .from('user_welcome_credits')
      .select('id, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingCredit) {
      return new Response(
        JSON.stringify({ success: false, message: 'Welcome credit already exists' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing transactions
    const { count: transactionCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (transactionCount && transactionCount > 0) {
      return new Response(
        JSON.stringify({ success: false, message: 'Not eligible - existing transactions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === ABUSE PREVENTION ===
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('normalized_email, phone, referred_by')
      .eq('id', user.id)
      .single();

    if (profile?.normalized_email) {
      const { data: emailAliasMatches } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('normalized_email', profile.normalized_email)
        .neq('id', user.id);

      if (emailAliasMatches && emailAliasMatches.length > 0) {
        const aliasUserIds = emailAliasMatches.map(m => m.id);
        const { data: aliasLedgers } = await supabaseAdmin
          .from('pet_fund_ledgers')
          .select('id')
          .in('user_id', aliasUserIds);

        if (aliasLedgers && aliasLedgers.length > 0) {
          logStep("ABUSE BLOCKED: Email alias detected");
          await supabaseAdmin.from('welcome_credit_abuse_signals').insert({
            user_id: user.id, signal_type: 'email_alias_match',
            signal_data: { normalized_email: profile.normalized_email }, severity: 'critical',
          });
          return new Response(
            JSON.stringify({ success: false, message: 'Not eligible for welcome credit' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (profile?.phone) {
      const { data: phoneMatches } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('phone', profile.phone)
        .neq('id', user.id);

      if (phoneMatches && phoneMatches.length > 0) {
        const phoneUserIds = phoneMatches.map(m => m.id);
        const { data: phoneLedgers } = await supabaseAdmin
          .from('pet_fund_ledgers')
          .select('id')
          .in('user_id', phoneUserIds);

        if (phoneLedgers && phoneLedgers.length > 0) {
          logStep("ABUSE BLOCKED: Phone reuse detected");
          await supabaseAdmin.from('welcome_credit_abuse_signals').insert({
            user_id: user.id, signal_type: 'phone_number_reuse',
            signal_data: { phone: profile.phone }, severity: 'critical',
          });
          return new Response(
            JSON.stringify({ success: false, message: 'Not eligible for welcome credit' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    if (deviceFingerprint) {
      const { data: fpLedgers } = await supabaseAdmin
        .from('pet_fund_ledgers')
        .select('id')
        .eq('device_fingerprint', deviceFingerprint);

      if (fpLedgers && fpLedgers.length > 0) {
        logStep("ABUSE BLOCKED: Device fingerprint match");
        await supabaseAdmin.from('welcome_credit_abuse_signals').insert({
          user_id: user.id, signal_type: 'device_fingerprint_match',
          signal_data: { fingerprint: deviceFingerprint }, severity: 'high',
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Not eligible for welcome credit' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    logStep("All abuse checks passed");

    // Check if program is enabled
    const { data: programSetting } = await supabaseAdmin
      .from('platform_settings')
      .select('value')
      .eq('key', 'welcome_credit_enabled')
      .maybeSingle();

    const programEnabled = programSetting ? programSetting.value === true || programSetting.value === 'true' : true;
    if (!programEnabled) {
      logStep("BLOCKED: Welcome credit program is paused");
      return new Response(
        JSON.stringify({ success: false, message: 'Welcome credit program is currently paused' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // === DETERMINE TIER ===
    const { data: promoData } = await supabaseAdmin.rpc('get_active_promotion');
    const clusterId = promoData?.[0]?.cluster_id ?? null;
    let seriesTier = promoData?.[0]?.series_tier ?? 'standard';

    logStep("Promotion tier determined", { seriesTier, clusterId });

    // Claim spot
    if (clusterId) {
      const { data: claimedTier } = await supabaseAdmin.rpc('claim_pet_fund_spot', { p_cluster_id: clusterId });
      seriesTier = claimedTier || 'standard';
    }

    const referredBy = profile?.referred_by || null;
    const tierConfig = TIER_CONFIG[seriesTier] || TIER_CONFIG.standard;

    // Initialize Pet Fund with tier
    const { data: ledgerId, error: fundError } = await supabaseAdmin.rpc('initialize_pet_fund', {
      p_user_id: user.id,
      p_referred_by: referredBy,
      p_series_tier: seriesTier,
      p_cluster_id: clusterId,
    });

    if (fundError) {
      logStep("Error initializing pet fund", { error: fundError.message });
      throw new Error('Failed to initialize Pet Fund');
    }

    logStep("Pet Fund initialized", { ledgerId, seriesTier, referredBy });

    await supabaseAdmin.from('welcome_credit_analytics').insert({
      event_type: 'pet_fund_initialized',
      user_id: user.id,
      event_data: {
        ledger_id: ledgerId,
        total_amount: tierConfig.totalPb,
        immediate_release: tierConfig.upfrontPb,
        series_tier: seriesTier,
        cluster_id: clusterId,
        referred_by: referredBy,
      },
    });

    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      title: '🎉 Welcome Credit Activated!',
      message: `Your $${tierConfig.totalPb / 1000} Pet Fund is live! $${tierConfig.upfrontPb / 1000} is available now — use it within 30 days!`,
      category: 'promotional',
    });

    return new Response(
      JSON.stringify({
        success: true,
        promotionType: 'pet_fund',
        seriesTier,
        message: `${tierConfig.label} Pet Fund activated!`,
        credit: {
          id: ledgerId,
          amount: tierConfig.upfrontPb,
          totalFund: tierConfig.totalPb,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error issuing welcome credit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
