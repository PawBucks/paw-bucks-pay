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
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    logStep("User authenticated", { userId: user.id });

    const { deviceFingerprint, ipAddress } = await req.json();

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already has a Pet Fund ledger (new system)
    const { data: existingLedger } = await supabaseAdmin
      .from('pet_fund_ledgers')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingLedger) {
      logStep("User already has Pet Fund", { ledgerId: existingLedger.id });
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Pet Fund already exists',
        }),
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
      logStep("User already has legacy credit", { creditId: existingCredit.id, status: existingCredit.status });
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Welcome credit already exists',
          credit: existingCredit,
        }),
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
        JSON.stringify({
          success: false,
          message: 'Not eligible - existing transactions',
        }),
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
        // Check if any of those profiles have a pet fund or welcome credit
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
            user_id: user.id,
            signal_type: 'email_alias_match',
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

    // Phone number reuse check
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
            user_id: user.id,
            signal_type: 'phone_number_reuse',
            signal_data: { phone: profile.phone },
            severity: 'critical',
          });
          return new Response(
            JSON.stringify({ success: false, message: 'Not eligible for welcome credit' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        }
      }
    }

    // Device fingerprint check
    if (deviceFingerprint) {
      const { data: fingerprintLedgers } = await supabaseAdmin
        .from('user_welcome_credits')
        .select('id')
        .eq('device_fingerprint', deviceFingerprint)
        .in('status', ['active', 'used']);

      if (fingerprintLedgers && fingerprintLedgers.length > 0) {
        logStep("ABUSE BLOCKED: Device fingerprint match", { fingerprint: deviceFingerprint });
        await supabaseAdmin.from('welcome_credit_abuse_signals').insert({
          user_id: user.id,
          signal_type: 'device_fingerprint_match',
          signal_data: { fingerprint: deviceFingerprint },
          severity: 'high',
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Not eligible for welcome credit' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // IP rate limiting
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
          user_id: user.id,
          signal_type: 'ip_rate_limit',
          signal_data: { ip_address: ipAddress, count: ipCredits.length },
          severity: 'high',
        });
        return new Response(
          JSON.stringify({ success: false, message: 'Not eligible for welcome credit' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    logStep("All abuse checks passed");

    // Check if welcome credit program is enabled
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

    // === INITIALIZE PET FUND (New System) ===
    const referredBy = profile?.referred_by || null;
    
    const { data: ledgerId, error: fundError } = await supabaseAdmin.rpc('initialize_pet_fund', {
      p_user_id: user.id,
      p_referred_by: referredBy,
    });

    if (fundError) {
      logStep("Error initializing pet fund", { error: fundError.message });
      throw new Error('Failed to initialize Pet Fund');
    }

    logStep("Pet Fund initialized", { ledgerId, referredBy });

    // Also create a legacy welcome credit record for backwards compatibility tracking
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 730); // 2 years for pet fund

    await supabaseAdmin
      .from('user_welcome_credits')
      .insert({
        user_id: user.id,
        credit_amount: 20000, // Initial available amount
        status: 'active',
        expires_at: expiresAt.toISOString(),
        device_fingerprint: deviceFingerprint || null,
        ip_address: ipAddress || null,
        phase_1_amount: 20000,
        phase_2_amount: 230000,
        phase_2_unlocked: false,
      })
      .select()
      .single();

    // Log analytics event
    await supabaseAdmin
      .from('welcome_credit_analytics')
      .insert({
        event_type: 'pet_fund_initialized',
        user_id: user.id,
        event_data: {
          ledger_id: ledgerId,
          total_amount: 250000,
          immediate_release: 20000,
          escrow: 230000,
          referred_by: referredBy,
        },
      });

    // Create in-app notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        title: '🎉 $250 Quarter-Million Pet Fund Activated!',
        message: 'You have $20 available now! Shop with any merchant and spend $40+ to use your first credit. $10 more unlocks every month for 23 months!',
        category: 'promotional',
      });

    logStep("Pet Fund fully initialized", {
      ledgerId,
      immediateRelease: 20000,
      escrow: 230000,
      months: 24,
    });

    return new Response(
      JSON.stringify({
        success: true,
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
  } catch (error: unknown) {
    console.error('Error issuing welcome credit:', error);
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
