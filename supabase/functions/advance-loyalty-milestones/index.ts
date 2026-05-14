import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[ADVANCE-LOYALTY] ${step}`, details ? JSON.stringify(details) : "");
};

/**
 * Get the current date parts in the user's local timezone.
 */
function getLocalDateParts(tz: string): { year: number; month: number; day: number; dateStr: string; monthDate: string } {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateStr = formatter.format(now); // YYYY-MM-DD
  const [year, month, day] = dateStr.split('-').map(Number);
  const monthDate = `${year}-${String(month).padStart(2, '0')}-01`;
  return { year, month, day, dateStr, monthDate };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const provided = req.headers.get("x-internal-secret");
    if (!internalSecret || provided !== internalSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { user_id, merchant_id, transaction_id, cash_amount } = await req.json();

    if (!user_id) {
      return new Response(JSON.stringify({ error: "user_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Processing loyalty advancement", { user_id, merchant_id, transaction_id, cash_amount });

    // Get user's timezone
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('timezone')
      .eq('id', user_id)
      .maybeSingle();
    const userTz = profile?.timezone || 'America/New_York';

    // ─── 1. UPSERT USER TIER STATUS ───
    const now = new Date();
    const local = getLocalDateParts(userTz);
    const currentMonthDate = local.monthDate;

    const { data: existingTier } = await supabaseAdmin
      .from("user_tier_status")
      .select("*")
      .eq("user_id", user_id)
      .maybeSingle();

    if (!existingTier) {
      logStep("Creating initial tier status");
      await supabaseAdmin.from("user_tier_status").insert({
        user_id,
        current_tier: "silver",
        tier_start_date: now.toISOString(),
        consecutive_active_months: 1,
        last_active_month: currentMonthDate,
        badges_earned_this_year: 0,
        transactions_this_year: 1,
      });
    } else {
      const updates: Record<string, unknown> = {
        transactions_this_year: existingTier.transactions_this_year + 1,
        updated_at: now.toISOString(),
      };

      // Track consecutive months using user's local month
      if (!existingTier.last_active_month || existingTier.last_active_month !== currentMonthDate) {
        const lastMonth = existingTier.last_active_month;
        if (lastMonth) {
          const [lastY, lastM] = lastMonth.split('-').map(Number);
          const diffMonths = (local.year - lastY) * 12 + (local.month - lastM);

          if (diffMonths === 1) {
            updates.consecutive_active_months = existingTier.consecutive_active_months + 1;
          } else if (diffMonths > 1) {
            updates.consecutive_active_months = 1;
          }
        }
        updates.last_active_month = currentMonthDate;
      }

      // Check for tier upgrade
      const { data: tierDefs } = await supabaseAdmin
        .from("consumer_tier_definitions")
        .select("*")
        .order("min_consecutive_months", { ascending: false });

      const newTransactions = (updates.transactions_this_year as number) || existingTier.transactions_this_year;
      const newMonths = (updates.consecutive_active_months as number) || existingTier.consecutive_active_months;
      const badges = existingTier.badges_earned_this_year;

      let newTier = "silver";
      for (const def of tierDefs || []) {
        if (
          newMonths >= def.min_consecutive_months &&
          badges >= def.min_badges_per_year &&
          newTransactions >= def.min_transactions_per_year
        ) {
          newTier = def.tier;
          break;
        }
      }

      if (newTier !== existingTier.current_tier) {
        updates.current_tier = newTier;
        updates.tier_start_date = now.toISOString();
        logStep("Tier upgraded!", { from: existingTier.current_tier, to: newTier });
      }

      await supabaseAdmin
        .from("user_tier_status")
        .update(updates)
        .eq("id", existingTier.id);
    }

    // ─── 2. ADVANCE LOYALTY MILESTONES ───
    const qualifyingAmount = cash_amount || 0;
    if (qualifyingAmount < 25) {
      logStep("Transaction below $25 minimum, skipping milestone advancement", { cash_amount: qualifyingAmount });
      return new Response(
        JSON.stringify({ success: true, milestone_advanced: false, reason: "below_minimum" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use user's local month for period boundaries
    const periodStart = new Date(Date.UTC(local.year, local.month - 1, 1));
    const periodEnd = new Date(Date.UTC(local.year, local.month - 1 + 12, 0));

    let { data: activeMilestone } = await supabaseAdmin
      .from("loyalty_milestones")
      .select("*")
      .eq("user_id", user_id)
      .eq("status", "in_progress")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!activeMilestone) {
      logStep("Creating new milestone");
      const { data: newMilestone } = await supabaseAdmin
        .from("loyalty_milestones")
        .insert({
          user_id,
          merchant_id: null,
          milestone_type: "visit_count",
          target_count: 12,
          current_count: 0,
          period_start: periodStart.toISOString(),
          period_end: periodEnd.toISOString(),
          credit_value: 50,
          platform_contribution: 50,
          merchant_contribution: 0,
          status: "in_progress",
        })
        .select()
        .single();

      activeMilestone = newMilestone;
    }

    if (!activeMilestone) {
      logStep("Failed to create/find milestone");
      return new Response(
        JSON.stringify({ success: false, error: "milestone_creation_failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const newCount = activeMilestone.current_count + 1;
    const isCompleted = newCount >= activeMilestone.target_count;

    const milestoneUpdate: Record<string, unknown> = {
      current_count: newCount,
      updated_at: now.toISOString(),
    };

    if (isCompleted) {
      milestoneUpdate.status = "completed";
      milestoneUpdate.completed_at = now.toISOString();
      logStep("Milestone completed!", { newCount, target: activeMilestone.target_count });
    }

    await supabaseAdmin
      .from("loyalty_milestones")
      .update(milestoneUpdate)
      .eq("id", activeMilestone.id);

    if (transaction_id) {
      await supabaseAdmin.from("milestone_transactions").insert({
        milestone_id: activeMilestone.id,
        transaction_id,
        amount: qualifyingAmount,
        transaction_date: now.toISOString(),
      }).then(() => {}).catch(err => logStep("milestone_transactions insert error", { error: String(err) }));
    }

    // ─── 3. AWARD SERVICE CREDIT ON COMPLETION ───
    if (isCompleted) {
      const creditExpiry = new Date(now);
      creditExpiry.setMonth(creditExpiry.getMonth() + 6);

      await supabaseAdmin.from("service_credits").insert({
        user_id,
        merchant_id: null,
        source_type: "milestone",
        source_id: activeMilestone.id,
        credit_value: activeMilestone.credit_value,
        remaining_value: activeMilestone.credit_value,
        description: `Loyal Pet Parent Guarantee - ${activeMilestone.target_count} visit milestone completed!`,
        expires_at: creditExpiry.toISOString(),
        status: "active",
      });

      logStep("Service credit awarded", { value: activeMilestone.credit_value });

      await supabaseAdmin.from("loyalty_warnings").insert({
        user_id,
        warning_type: "milestone_completed",
        message: `🎉 Congratulations! You completed ${activeMilestone.target_count} visits and earned a $${activeMilestone.credit_value} free service credit!`,
        urgency: "high",
        related_entity_type: "milestone",
        related_entity_id: activeMilestone.id,
        action_deadline: creditExpiry.toISOString(),
      });
    }

    // ─── 4. UPDATE BADGE STREAK ───
    const today = local.dateStr;

    await supabaseAdmin
      .from("user_badge_streaks")
      .upsert(
        {
          user_id,
          streak_type: "monthly",
          current_streak: 1,
          longest_streak: 1,
          last_earned_date: today,
          streak_start_date: today,
        },
        { onConflict: "user_id,streak_type", ignoreDuplicates: true }
      )
      .then(() => {})
      .catch(() => {});

    const { data: streak } = await supabaseAdmin
      .from("user_badge_streaks")
      .select("*")
      .eq("user_id", user_id)
      .eq("streak_type", "monthly")
      .maybeSingle();

    if (streak) {
      const lastDateStr = streak.last_earned_date;

      if (!lastDateStr || lastDateStr !== today) {
        const currentYearMonth = `${local.year}-${String(local.month).padStart(2, '0')}`;
        let lastYearMonth: string | null = null;
        if (lastDateStr) {
          const [ly, lm] = lastDateStr.split('-').map(Number);
          lastYearMonth = `${ly}-${String(lm).padStart(2, '0')}`;
        }
        
        if (lastYearMonth && lastYearMonth !== currentYearMonth) {
          const [ly, lm] = lastDateStr!.split('-').map(Number);
          const diffM = (local.year - ly) * 12 + (local.month - lm);

          if (diffM === 1) {
            await supabaseAdmin
              .from("user_badge_streaks")
              .update({
                current_streak: streak.current_streak + 1,
                longest_streak: Math.max(streak.longest_streak, streak.current_streak + 1),
                last_earned_date: today,
                updated_at: now.toISOString(),
              })
              .eq("id", streak.id);
          } else if (diffM > 1) {
            await supabaseAdmin
              .from("user_badge_streaks")
              .update({
                current_streak: 1,
                streak_start_date: today,
                last_earned_date: today,
                updated_at: now.toISOString(),
              })
              .eq("id", streak.id);
          }
        } else if (!lastYearMonth) {
          await supabaseAdmin
            .from("user_badge_streaks")
            .update({ last_earned_date: today, updated_at: now.toISOString() })
            .eq("id", streak.id);
        }
      }
    }

    logStep("Loyalty advancement complete", {
      milestone_id: activeMilestone.id,
      new_count: newCount,
      completed: isCompleted,
    });

    return new Response(
      JSON.stringify({
        success: true,
        milestone_advanced: true,
        milestone_id: activeMilestone.id,
        new_count: newCount,
        completed: isCompleted,
        credit_awarded: isCompleted ? activeMilestone.credit_value : 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    logStep("Error", { error: String(error) });
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
