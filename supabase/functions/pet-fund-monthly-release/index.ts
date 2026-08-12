import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkInternalSecret } from "../_shared/internal-auth.ts";
import { currentDateInTz } from "../_shared/tz.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders }
);
  }

  const _authResp = await checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[PET-FUND-RELEASE] Starting monthly release job...');

    // 0. Expire unused credits first
    const { data: expiredCount, error: expireError } = await supabaseAdmin.rpc('expire_unused_pet_fund_credits');
    if (expireError) {
      console.error('[PET-FUND-RELEASE] Error expiring credits:', expireError);
    } else {
      console.log(`[PET-FUND-RELEASE] Expired ${expiredCount || 0} unused credits`);
    }

    // 1. Get all due pet fund releases
    // scheduled_at is already stored in UTC (converted from user's local midnight),
    // so comparing against now() is correct
    const { data: dueReleases, error: releaseError } = await supabaseAdmin
      .from('pet_fund_releases')
      .select('id, ledger_id, user_id, amount, month_number, scheduled_at')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());

    if (releaseError) throw releaseError;

    // Get user timezones for all affected users to validate local midnight has passed
    const releaseUserIds = [...new Set((dueReleases || []).map(r => r.user_id))];
    const { data: releaseProfiles } = releaseUserIds.length > 0
      ? await supabaseAdmin.from('profiles').select('id, timezone').in('id', releaseUserIds)
      : { data: [] };
    
    const releaseTzMap = new Map<string, string>();
    for (const p of releaseProfiles || []) {
      releaseTzMap.set(p.id, p.timezone || 'America/New_York');
    }

    let releasedCount = 0;
    let skippedCount = 0;

    for (const release of (dueReleases || [])) {
      // Safety gate: only release once the calendar date has actually arrived
      // in the pet owner's own timezone (scheduled_at is local midnight in UTC).
      const tz = releaseTzMap.get(release.user_id) || 'America/New_York';
      const localToday = currentDateInTz(tz);
      const scheduledLocalDate = new Intl.DateTimeFormat('en-CA', {
        timeZone: tz,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      }).format(new Date(release.scheduled_at));

      if (localToday < scheduledLocalDate) {
        skippedCount++;
        continue;
      }

      const { error: rpcError } = await supabaseAdmin.rpc('release_pet_fund_installment', {
        p_release_id: release.id,
      });

      if (rpcError) {
        console.error(`[PET-FUND-RELEASE] Failed to release ${release.id}:`, rpcError);
        continue;
      }

      await supabaseAdmin.from('notifications').insert({
        user_id: release.user_id,
        title: '💰 Monthly Pet Fund Released!',
        message: `$${(release.amount / 1000).toFixed(0)} in PawBucks has been added to your Pet Fund! Use it within 30 days before it expires.`,
        category: 'promotional',
      });

      releasedCount++;
    }

    // 2. Release due referrer bonuses
    const { data: dueBonuses, error: bonusError } = await supabaseAdmin
      .from('pet_fund_referrer_bonuses')
      .select('id, referrer_id, amount, referee_id')
      .eq('status', 'locked')
      .lte('release_at', new Date().toISOString());

    if (bonusError) {
      console.error('[PET-FUND-RELEASE] Error fetching due bonuses:', bonusError);
    }

    let bonusesReleased = 0;
    for (const bonus of (dueBonuses || [])) {
      const { error: bonusRpcError } = await supabaseAdmin.rpc('release_referrer_bonus', {
        p_bonus_id: bonus.id,
      });

      if (bonusRpcError) {
        console.error(`[PET-FUND-RELEASE] Failed to release bonus ${bonus.id}:`, bonusRpcError);
        continue;
      }

      bonusesReleased++;
    }

    console.log(`[PET-FUND-RELEASE] Complete: ${releasedCount} installments, ${skippedCount} skipped (local midnight not reached), ${bonusesReleased} bonuses released, ${expiredCount || 0} expired`);

    return new Response(JSON.stringify({
      success: true,
      releasedCount,
      skippedCount,
      bonusesReleased,
      expiredCount: expiredCount || 0,
      timestamp: new Date().toISOString(),
    }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
  } catch (error: unknown) {
    console.error('[PET-FUND-RELEASE] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});
