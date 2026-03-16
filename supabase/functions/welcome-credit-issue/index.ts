import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
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
      .select('id, status, credit_amount, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingCredit) {
      logStep("User already has credit", { creditId: existingCredit.id, status: existingCredit.status });
      return new Response(
        JSON.stringify({ success: false, message: 'Welcome credit already exists', credit: existingCredit }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check for existing transactions (ineligible)
    const { count: transactionCount } = await supabaseAdmin
      .from('transactions')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id);

    if (transactionCount && transactionCount > 0) {
      logStep("User has existing transactions", { count: transactionCount });
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
        const { data: aliasCredits } = await supabaseAdmin
          .from('user_welcome_credits')
          .select('id')
          .in('user_id', aliasUserIds)
          .in('status', ['active', 'used']);

        if ((aliasLedgers && aliasLedgers.length > 0) || (aliasCredits && aliasCredits.length > 0)) {
          logStep("ABUSE BLOCKED: Email alias detected", { normalizedEmail: profile.normalized_email });
          await supabaseAdmin.from('welcome_credit_abuse_signals').insert({
            user_id: user.id, signal_type: 'email_alias_match',
            signal_data: { normalized_email: profile.normalized_email, matching_profiles: aliasUserIds.length },
            severity: 'critical',
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
        const { data: phoneCredits } = await supabaseAdmin
          .from('user_welcome_credits')
          .select('id')
          .in('user_id', phoneUserIds)
          .in('status', ['active', 'used']);

        if ((phoneLedgers && phoneLedgers.length > 0) || (phoneCredits && phoneCredits.length > 0)) {
          logStep("ABUSE BLOCKED: Phone reuse detected", { phone: profile.phone });
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
      const { data: fingerprintLedgers } = await supabaseAdmin
        .from('user_welcome_credits')
        .select('id')
        .eq('device_fingerprint', deviceFingerprint)
        .in('status', ['active', 'used']);

      if (fingerprintLedgers && fingerprintLedgers.length > 0) {
        logStep("ABUSE BLOCKED: Device fingerprint match", { fingerprint: deviceFingerprint });
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

    if (ipAddress) {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: ipCredits } = await supabaseAdmin
        .from('user_welcome_credits')
        .select('id')
        .eq('ip_address', ipAddress)
        .gte('created_at', thirtyDaysAgo)
        .in('status', ['active', 'used']);

      if (ipCredits && ipCredits.length >= 3) {
        logStep("ABUSE BLOCKED: IP rate limit exceeded", { ip: ipAddress });
        await supabaseAdmin.from('welcome_credit_abuse_signals').insert({
          user_id: user.id, signal_type: 'ip_rate_limit',
          signal_data: { ip_address: ipAddress, count: ipCredits.length }, severity: 'high',
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

    // === DETERMINE PROMOTION TYPE ===
    // Check active cluster for Pet Fund spot availability
    const { data: promoData } = await supabaseAdmin.rpc('get_active_promotion');
    const promotionType = promoData?.[0]?.promotion_type ?? 'welcome_credit';
    const clusterId = promoData?.[0]?.cluster_id ?? null;
    const spotsRemaining = promoData?.[0]?.spots_remaining ?? 0;

    logStep("Promotion type determined", { promotionType, clusterId, spotsRemaining });

    const referredBy = profile?.referred_by || null;

    if (promotionType === 'pet_fund') {
      // === PET FUND PATH (250,000 PB over 24 months) ===
      // Atomically claim a spot
      const { data: spotClaimed } = await supabaseAdmin.rpc('claim_pet_fund_spot', { p_cluster_id: clusterId });

      if (!spotClaimed) {
        // Race condition: spots filled while processing, fall through to welcome credit
        logStep("Pet Fund spot claim failed, falling back to welcome credit");
        return await issueWelcomeCredit(supabaseAdmin, user.id, referredBy, clusterId, deviceFingerprint, ipAddress);
      }

      // Initialize Pet Fund
      const { data: ledgerId, error: fundError } = await supabaseAdmin.rpc('initialize_pet_fund', {
        p_user_id: user.id,
        p_referred_by: referredBy,
      });

      if (fundError) {
        logStep("Error initializing pet fund", { error: fundError.message });
        throw new Error('Failed to initialize Pet Fund');
      }

      logStep("Pet Fund initialized", { ledgerId, referredBy });

      // Create legacy tracking record
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 730);

      await supabaseAdmin.from('user_welcome_credits').insert({
        user_id: user.id,
        credit_amount: 20000,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        device_fingerprint: deviceFingerprint || null,
        ip_address: ipAddress || null,
        phase_1_amount: 20000,
        phase_2_amount: 230000,
        phase_2_unlocked: false,
        promotion_type: 'pet_fund',
        cluster_id: clusterId,
      });

      await supabaseAdmin.from('welcome_credit_analytics').insert({
        event_type: 'pet_fund_initialized',
        user_id: user.id,
        event_data: {
          ledger_id: ledgerId,
          total_amount: 250000,
          immediate_release: 20000,
          escrow: 230000,
          referred_by: referredBy,
          cluster_id: clusterId,
        },
      });

      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        title: '🎉 $250 Quarter-Million Pet Fund Activated!',
        message: 'You have $20 available now! Shop with any merchant and spend $40+ to use your first credit. $10 more unlocks every month for 23 months!',
        category: 'promotional',
      });

      return new Response(
        JSON.stringify({
          success: true,
          promotionType: 'pet_fund',
          message: 'Quarter-Million Pet Fund activated!',
          credit: {
            id: ledgerId,
            amount: 20000,
            totalFund: 250000,
            escrow: 230000,
            expiresAt: expiresAt.toISOString(),
          },
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    } else {
      // === WELCOME CREDIT PATH (50,000 PB immediate) ===
      return await issueWelcomeCredit(supabaseAdmin, user.id, referredBy, clusterId, deviceFingerprint, ipAddress);
    }
  } catch (error: unknown) {
    console.error('Error issuing welcome credit:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});

async function issueWelcomeCredit(
  supabaseAdmin: ReturnType<typeof createClient>,
  userId: string,
  referredBy: string | null,
  clusterId: string | null,
  deviceFingerprint: string | null,
  ipAddress: string | null,
) {
  const logStep = (step: string, details?: Record<string, unknown>) => {
    console.log(`[WELCOME-CREDIT-ISSUE] ${step}`, details ? JSON.stringify(details) : "");
  };

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 365); // 1 year for welcome credit

  // 50,000 PB all available immediately, $20 minimum transaction
  await supabaseAdmin.from('user_welcome_credits').insert({
    user_id: userId,
    credit_amount: 50000,
    status: 'active',
    expires_at: expiresAt.toISOString(),
    device_fingerprint: deviceFingerprint || null,
    ip_address: ipAddress || null,
    phase_1_amount: 50000,
    phase_2_amount: 0,
    phase_2_unlocked: true, // All available immediately
    promotion_type: 'welcome_credit',
    cluster_id: clusterId,
  });

  // Credit the user's PawBucks wallet directly
  await supabaseAdmin.from('pawbucks_activity').insert({
    user_id: userId,
    type: 'credit',
    amount: 50000,
    source: 'welcome_credit',
    description: '$50 Welcome Credit - all available immediately',
    pawbucks_status: 'available',
  });

  await supabaseAdmin.from('welcome_credit_analytics').insert({
    event_type: 'welcome_credit_issued',
    user_id: userId,
    event_data: {
      total_amount: 50000,
      immediate: true,
      referred_by: referredBy,
      cluster_id: clusterId,
    },
  });

  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    title: '🎉 $50 Welcome Credit Activated!',
    message: 'You have $50 in PawBucks available now! Shop with any merchant and spend $20+ to use your credit.',
    category: 'promotional',
  });

  logStep("Welcome Credit issued", { userId, amount: 50000 });

  return new Response(
    JSON.stringify({
      success: true,
      promotionType: 'welcome_credit',
      message: '$50 Welcome Credit activated!',
      credit: {
        amount: 50000,
        totalFund: 50000,
        escrow: 0,
        expiresAt: expiresAt.toISOString(),
      },
    }),
    {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
        'Content-Type': 'application/json',
      },
    }
  );
}
