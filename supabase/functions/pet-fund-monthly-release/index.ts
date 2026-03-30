import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

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
    const { data: dueReleases, error: releaseError } = await supabaseAdmin
      .from('pet_fund_releases')
      .select('id, ledger_id, user_id, amount, month_number')
      .eq('status', 'pending')
      .lte('scheduled_at', new Date().toISOString());

    if (releaseError) throw releaseError;

    let releasedCount = 0;
    for (const release of (dueReleases || [])) {
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

    console.log(`[PET-FUND-RELEASE] Complete: ${releasedCount} installments, ${bonusesReleased} bonuses released, ${expiredCount || 0} expired`);

    return new Response(JSON.stringify({
      success: true,
      releasedCount,
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
