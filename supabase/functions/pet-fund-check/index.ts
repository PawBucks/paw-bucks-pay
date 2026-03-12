import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get pet fund ledger
    const { data: ledger } = await supabaseAdmin
      .from('pet_fund_ledgers')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!ledger) {
      // Check for legacy welcome credit
      const { data: legacyCredit } = await supabaseAdmin
        .from('user_welcome_credits')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'active')
        .maybeSingle();

      return new Response(JSON.stringify({
        hasPetFund: false,
        hasLegacyCredit: !!legacyCredit,
        legacyCredit: legacyCredit || null,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Get releases
    const { data: releases } = await supabaseAdmin
      .from('pet_fund_releases')
      .select('*')
      .eq('ledger_id', ledger.id)
      .order('month_number', { ascending: true });

    // Get referrer bonuses for this user
    const { data: referrerBonuses } = await supabaseAdmin
      .from('pet_fund_referrer_bonuses')
      .select('*')
      .eq('referrer_id', user.id);

    const nextRelease = releases?.find(r => r.status === 'pending');
    const availableReleases = releases?.filter(r => r.status === 'released' && r.used_at === null) || [];

    // Determine min transaction: if month 0 is still available (not used), $40; otherwise $20
    const month0 = releases?.find(r => r.month_number === 0);
    const month0Used = month0?.used_at !== null;
    const currentMinTransactionUsd = !month0Used && availableReleases.some(r => r.month_number === 0) ? 40 : 20;

    return new Response(JSON.stringify({
      hasPetFund: true,
      ledger: {
        id: ledger.id,
        totalAmount: ledger.total_amount,
        availableBalance: ledger.available_balance,
        escrowBalance: ledger.escrow_balance,
        totalReleased: ledger.total_released,
        totalUsed: ledger.total_used,
        status: ledger.status,
        createdAt: ledger.created_at,
      },
      releases: releases?.map(r => ({
        id: r.id,
        monthNumber: r.month_number,
        amount: r.amount,
        minTransactionUsd: Number(r.min_transaction_usd),
        status: r.used_at ? 'used' : r.status,
        scheduledAt: r.scheduled_at,
        releasedAt: r.released_at,
        usedAt: r.used_at,
      })) || [],
      nextRelease: nextRelease ? {
        monthNumber: nextRelease.month_number,
        amount: nextRelease.amount,
        scheduledAt: nextRelease.scheduled_at,
      } : null,
      availableCredits: availableReleases.length,
      currentMinTransactionUsd,
      referrerBonuses: referrerBonuses?.map(b => ({
        refereeId: b.referee_id,
        amount: b.amount,
        status: b.status,
        releaseAt: b.release_at,
        releasedAt: b.released_at,
      })) || [],
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('Error in pet-fund-check:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }
});
