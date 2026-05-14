import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CHECK-GUILT-BADGES] ${step}`, details ? JSON.stringify(details) : "");
};

// Map merchant categories to badge categories
const categoryMappings: Record<string, string[]> = {
  'treats': ['food', 'treats', 'bakery', 'pet food', 'pet_store'],
  'toys': ['pet_store', 'toys', 'accessories', 'retail'],
  'grooming': ['grooming', 'groomer', 'spa', 'mobile_groomer'],
  'veterinary': ['veterinary', 'vet', 'pharmacy', 'animal hospital'],
  'accessories': ['accessories', 'pet_store', 'retail', 'fashion'],
  'food': ['food', 'treats', 'bakery', 'pet food'],
};

/**
 * Get period boundaries in the user's local timezone.
 * Falls back to America/New_York if no timezone provided.
 */
function getPeriodBoundaries(period: string, userTimezone: string): { start: Date; end: Date } {
  const tz = userTimezone || 'America/New_York';
  
  // Get current date parts in user's timezone
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const year = parseInt(parts.find(p => p.type === 'year')!.value);
  const month = parseInt(parts.find(p => p.type === 'month')!.value) - 1; // 0-indexed
  const day = parseInt(parts.find(p => p.type === 'day')!.value);
  const weekday = parts.find(p => p.type === 'weekday')!.value;

  // Map weekday string to number (Sun=0, Mon=1, ...)
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[weekday] ?? 0;

  // Helper: create a Date at midnight in the user's timezone
  // We use the Intl approach to get the UTC offset, then construct properly
  function midnightInTz(y: number, m: number, d: number): Date {
    // Create a date string and parse it in the target timezone
    const dateStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}T00:00:00`;
    // Get UTC offset for this date in this timezone
    const tempDate = new Date(dateStr + 'Z');
    const utcStr = tempDate.toLocaleString('en-US', { timeZone: 'UTC' });
    const tzStr = tempDate.toLocaleString('en-US', { timeZone: tz });
    const utcTime = new Date(utcStr).getTime();
    const tzTime = new Date(tzStr).getTime();
    const offset = utcTime - tzTime;
    
    // Midnight in user's tz = midnight UTC + offset
    return new Date(new Date(dateStr + 'Z').getTime() + offset);
  }

  let start: Date;
  let end: Date;

  switch (period) {
    case 'day':
      start = midnightInTz(year, month, day);
      end = midnightInTz(year, month, day + 1);
      break;
    case 'week': {
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start = midnightInTz(year, month, day + mondayOffset);
      end = midnightInTz(year, month, day + mondayOffset + 7);
      break;
    }
    case 'month':
      start = midnightInTz(year, month, 1);
      end = midnightInTz(year, month + 1, 1);
      break;
    default:
      start = midnightInTz(year, month, day);
      end = midnightInTz(year, month, day + 1);
  }

  return { start, end };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const provided = req.headers.get("x-internal-secret");
    if (!internalSecret || provided !== internalSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const body = await req.json();
    const { userId, transactionAmount, merchantCategory, transactionId } = body;

    logStep("Processing badge check", { userId, transactionAmount, merchantCategory, transactionId });

    if (!userId || !transactionAmount) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get user's timezone
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('timezone')
      .eq('id', userId)
      .maybeSingle();
    const userTimezone = profile?.timezone || 'America/New_York';

    // Get active badge definitions
    const { data: badges, error: badgeError } = await supabaseAdmin
      .from('guilt_badge_definitions')
      .select('*')
      .eq('is_active', true)
      .order('display_order');

    if (badgeError) {
      logStep("Error fetching badges", { error: badgeError.message });
      throw badgeError;
    }

    const earnedBadges: any[] = [];
    const normalizedCategory = (merchantCategory || '').toLowerCase();

    for (const badge of badges || []) {
      const matchingCategories = categoryMappings[badge.category] || [badge.category];
      const categoryMatches = matchingCategories.some(cat => 
        normalizedCategory.includes(cat) || cat.includes(normalizedCategory)
      );

      if (!categoryMatches) {
        continue;
      }

      // Use user's timezone for period boundaries
      const { start, end } = getPeriodBoundaries(badge.threshold_period, userTimezone);

      const { data: existingBadge } = await supabaseAdmin
        .from('user_guilt_badges')
        .select('id')
        .eq('user_id', userId)
        .eq('badge_id', badge.id)
        .gte('period_start', start.toISOString())
        .lt('period_end', end.toISOString())
        .maybeSingle();

      if (existingBadge) {
        logStep("Badge already earned this period", { badgeKey: badge.badge_key });
        continue;
      }

      const { data: progress } = await supabaseAdmin
        .from('guilt_badge_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('badge_id', badge.id)
        .eq('period_start', start.toISOString())
        .maybeSingle();

      const currentAmount = (progress?.current_amount || 0) + transactionAmount;

      if (progress) {
        await supabaseAdmin
          .from('guilt_badge_progress')
          .update({ 
            current_amount: currentAmount,
            last_updated: new Date().toISOString()
          })
          .eq('id', progress.id);
      } else {
        await supabaseAdmin
          .from('guilt_badge_progress')
          .insert({
            user_id: userId,
            badge_id: badge.id,
            current_amount: currentAmount,
            period_start: start.toISOString(),
            period_end: end.toISOString(),
          });
      }

      logStep("Progress updated", { 
        badgeKey: badge.badge_key, 
        currentAmount, 
        threshold: badge.threshold_amount 
      });

      if (currentAmount >= badge.threshold_amount) {
        const rewardExpiresAt = new Date();
        rewardExpiresAt.setHours(rewardExpiresAt.getHours() + (badge.reward_duration_hours || 48));

        const { data: newBadge, error: insertError } = await supabaseAdmin
          .from('user_guilt_badges')
          .insert({
            user_id: userId,
            badge_id: badge.id,
            spending_amount: currentAmount,
            period_start: start.toISOString(),
            period_end: end.toISOString(),
            reward_expires_at: rewardExpiresAt.toISOString(),
            metadata: { triggering_transaction_id: transactionId },
          })
          .select()
          .single();

        if (insertError) {
          logStep("Error awarding badge", { error: insertError.message });
          continue;
        }

        logStep("Badge awarded!", { badgeKey: badge.badge_key, badgeId: newBadge.id });

        if (badge.reward_type) {
          const { data: reward } = await supabaseAdmin
            .from('guilt_badge_rewards')
            .insert({
              user_id: userId,
              badge_id: badge.id,
              user_badge_id: newBadge.id,
              reward_type: badge.reward_type,
              reward_value: badge.reward_value,
              expires_at: rewardExpiresAt.toISOString(),
              status: 'active',
            })
            .select()
            .single();

          logStep("Reward created", { rewardId: reward?.id });

          if (badge.reward_type === 'pawbucks_bonus' && badge.reward_value) {
            const pawbucksAmount = Math.floor(badge.reward_value);
            
            let { data: wallet } = await supabaseAdmin
              .from('pawbucks_wallet')
              .select('balance')
              .eq('user_id', userId)
              .maybeSingle();

            if (!wallet) {
              const { data: newWallet } = await supabaseAdmin
                .from('pawbucks_wallet')
                .insert({ user_id: userId, balance: 0 })
                .select()
                .single();
              wallet = newWallet;
            }

            if (wallet) {
              await supabaseAdmin
                .from('pawbucks_wallet')
                .update({ balance: (wallet.balance || 0) + pawbucksAmount })
                .eq('user_id', userId);

              await supabaseAdmin.from('pawbucks_activity').insert({
                user_id: userId,
                amount: pawbucksAmount,
                type: 'earn',
                source: 'Badge Reward',
                description: `🎉 ${badge.emoji} ${badge.name} badge reward: +${pawbucksAmount} PawBucks!`,
                pawbucks_status: 'available',
              });

              if (reward) {
                await supabaseAdmin
                  .from('guilt_badge_rewards')
                  .update({ status: 'used', used_at: new Date().toISOString() })
                  .eq('id', reward.id);
              }

              logStep("PawBucks bonus auto-claimed", { amount: pawbucksAmount });
            }
          }
        }

        const { data: promotions } = await supabaseAdmin
          .from('badge_promotions')
          .select('id, duration_hours')
          .eq('badge_id', badge.id)
          .eq('is_active', true);

        for (const promo of promotions || []) {
          const promoExpiresAt = new Date();
          promoExpiresAt.setHours(promoExpiresAt.getHours() + promo.duration_hours);

          await supabaseAdmin.from('user_badge_promotions').insert({
            user_id: userId,
            promotion_id: promo.id,
            user_badge_id: newBadge.id,
            expires_at: promoExpiresAt.toISOString(),
          }).maybeSingle();

          logStep("Promotion activated for user", { promotionId: promo.id, expiresAt: promoExpiresAt.toISOString() });
        }

        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title: `${badge.emoji} ${badge.name} Badge Unlocked!`,
          message: `You earned the ${badge.name} badge! ${badge.reward_description || ''} Check Pet Store for exclusive discounts!`,
          category: 'promotional',
        });

        earnedBadges.push({
          badge,
          earnedAt: newBadge.earned_at,
          rewardExpiresAt: rewardExpiresAt.toISOString(),
        });
      }
    }

    logStep("Badge check complete", { earnedCount: earnedBadges.length });

    return new Response(
      JSON.stringify({ 
        success: true, 
        earnedBadges,
        message: earnedBadges.length > 0 
          ? `Earned ${earnedBadges.length} new badge(s)!` 
          : 'Progress updated'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    logStep("Error in badge check", { error: String(error) });
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
