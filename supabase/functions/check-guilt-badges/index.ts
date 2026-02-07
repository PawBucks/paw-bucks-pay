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

// Get period boundaries
function getPeriodBoundaries(period: string): { start: Date; end: Date } {
  const now = new Date();
  let start: Date;
  let end: Date;

  switch (period) {
    case 'day':
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setDate(end.getDate() + 1);
      break;
    case 'week':
      // Start from Monday
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    default:
      start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      end = new Date(start);
      end.setDate(end.getDate() + 1);
  }

  return { start, end };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
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
      // Check if this transaction's category matches the badge category
      const matchingCategories = categoryMappings[badge.category] || [badge.category];
      const categoryMatches = matchingCategories.some(cat => 
        normalizedCategory.includes(cat) || cat.includes(normalizedCategory)
      );

      if (!categoryMatches) {
        continue;
      }

      const { start, end } = getPeriodBoundaries(badge.threshold_period);

      // Check if already earned this badge in this period
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

      // Get or create progress tracking
      const { data: progress } = await supabaseAdmin
        .from('guilt_badge_progress')
        .select('*')
        .eq('user_id', userId)
        .eq('badge_id', badge.id)
        .eq('period_start', start.toISOString())
        .maybeSingle();

      const currentAmount = (progress?.current_amount || 0) + transactionAmount;

      // Update or create progress
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

      // Check if threshold met
      if (currentAmount >= badge.threshold_amount) {
        // Award the badge!
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

        // Create the reward
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

          // If it's a PawBucks bonus, auto-claim it
          if (badge.reward_type === 'pawbucks_bonus' && badge.reward_value) {
            const pawbucksAmount = Math.floor(badge.reward_value);
            
            // Get or create wallet
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

              // Mark reward as used
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

        // Create notification for the user
        await supabaseAdmin.from('notifications').insert({
          user_id: userId,
          title: `${badge.emoji} ${badge.name} Badge Unlocked!`,
          message: `You earned the ${badge.name} badge! ${badge.reward_description || ''}`,
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
