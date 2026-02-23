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

    const { deviceFingerprint, ipAddress } = await req.json();

    // Use service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if user already has a credit
    const { data: existingCredit } = await supabaseAdmin
      .from('user_welcome_credits')
      .select('id, status, credit_amount, expires_at')
      .eq('user_id', user.id)
      .maybeSingle();

    if (existingCredit) {
      logStep("User already has credit", { creditId: existingCredit.id, status: existingCredit.status });
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

    // Check 1: Normalized email alias detection
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('normalized_email, phone')
      .eq('id', user.id)
      .single();

    if (profile?.normalized_email) {
      const { data: emailAliasMatches } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('normalized_email', profile.normalized_email)
        .neq('id', user.id);

      if (emailAliasMatches && emailAliasMatches.length > 0) {
        // Check if any of those profiles have a welcome credit
        const aliasUserIds = emailAliasMatches.map(m => m.id);
        const { data: aliasCredits } = await supabaseAdmin
          .from('user_welcome_credits')
          .select('id')
          .in('user_id', aliasUserIds)
          .in('status', ['active', 'used']);

        if (aliasCredits && aliasCredits.length > 0) {
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

    // Check 2: Phone number reuse
    if (profile?.phone) {
      const { data: phoneMatches } = await supabaseAdmin
        .from('profiles')
        .select('id')
        .eq('phone', profile.phone)
        .neq('id', user.id);

      if (phoneMatches && phoneMatches.length > 0) {
        const phoneUserIds = phoneMatches.map(m => m.id);
        const { data: phoneCredits } = await supabaseAdmin
          .from('user_welcome_credits')
          .select('id')
          .in('user_id', phoneUserIds)
          .in('status', ['active', 'used']);

        if (phoneCredits && phoneCredits.length > 0) {
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

    // Check 3: Device fingerprint
    if (deviceFingerprint) {
      const { data: fingerprintMatches } = await supabaseAdmin
        .from('user_welcome_credits')
        .select('id')
        .eq('device_fingerprint', deviceFingerprint)
        .in('status', ['active', 'used']);

      if (fingerprintMatches && fingerprintMatches.length > 0) {
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

    // Check 4: IP rate limiting (max 3 credits from same IP in 30 days)
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

    // Issue the welcome credit (45 days expiration)
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 45);

    const { data: newCredit, error: insertError } = await supabaseAdmin
      .from('user_welcome_credits')
      .insert({
        user_id: user.id,
        credit_amount: 50000,
        status: 'active',
        expires_at: expiresAt.toISOString(),
        device_fingerprint: deviceFingerprint || null,
        ip_address: ipAddress || null,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error issuing credit:', insertError);
      throw new Error('Failed to issue welcome credit');
    }

    // Log analytics event
    await supabaseAdmin
      .from('welcome_credit_analytics')
      .insert({
        event_type: 'credit_issued',
        user_id: user.id,
        event_data: {
          credit_id: newCredit.id,
          amount: 50000,
          expires_at: expiresAt.toISOString(),
        },
      });

    // Create in-app notification
    await supabaseAdmin
      .from('notifications')
      .insert({
        user_id: user.id,
        title: '🎉 50,000 PawBucks Welcome Credit!',
        message: 'You have $50 toward your first booking with a participating partner. Use it before it expires!',
        category: 'promotional',
      });

    logStep("Welcome credit issued", {
      creditId: newCredit.id,
      amount: 50000,
      expiresAt: expiresAt.toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Welcome credit issued successfully',
        credit: {
          id: newCredit.id,
          amount: newCredit.credit_amount,
          expiresAt: newCredit.expires_at,
          daysRemaining: 45,
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
