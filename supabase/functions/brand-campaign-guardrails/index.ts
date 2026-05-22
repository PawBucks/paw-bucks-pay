// Runs every 15 minutes via pg_cron.
// 1. Auto-pause campaigns hitting daily_spend_cap or pool depletion threshold.
// 2. Auto-replenish where enabled, by charging saved Stripe payment method off-session.
// 3. Aggregate hourly stats.
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
  const stripe = stripeKey ? new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" }) : null;

  const summary = {
    checked: 0,
    paused_for_daily_cap: 0,
    paused_for_pool: 0,
    replenished: 0,
    replenish_failed: 0,
    hourly_aggregated: false,
  };

  try {
    // 1. Aggregate hourly stats for the previous full hour
    const prevHour = new Date();
    prevHour.setMinutes(0, 0, 0);
    prevHour.setHours(prevHour.getHours() - 1);
    await admin.rpc("aggregate_brand_campaign_hourly_stats", { target_hour: prevHour.toISOString() });
    summary.hourly_aggregated = true;

    // 2. Pull active campaigns
    const { data: campaigns } = await admin
      .from("brand_campaigns")
      .select("*, brand_accounts!inner(id, user_id, brand_name)")
      .eq("status", "active");

    const today = new Date(); today.setHours(0, 0, 0, 0);

    for (const campaign of campaigns || []) {
      summary.checked++;

      // Pool depletion check
      const remaining = Number(campaign.pawbucks_pool) - Number(campaign.total_distributed);
      const pctRemaining = campaign.pawbucks_pool > 0 ? (remaining / campaign.pawbucks_pool) * 100 : 100;
      const threshold = Number(campaign.auto_pause_threshold_pct ?? 5);

      const shouldReplenish = campaign.auto_replenish_enabled
        && stripe
        && pctRemaining <= Number(campaign.auto_replenish_threshold ?? 10)
        && Number(campaign.auto_replenish_amount_usd ?? 0) > 0;

      if (shouldReplenish) {
        // Find default payment method
        const { data: pm } = await admin
          .from("brand_payment_methods")
          .select("*")
          .eq("brand_id", (campaign.brand_accounts as any).id)
          .eq("is_default", true)
          .maybeSingle();

        if (pm) {
          try {
            const amount = Math.round(Number(campaign.auto_replenish_amount_usd) * 100);
            const intent = await stripe!.paymentIntents.create({
              amount,
              currency: "usd",
              customer: pm.stripe_customer_id,
              payment_method: pm.stripe_payment_method_id,
              off_session: true,
              confirm: true,
              metadata: { campaign_id: campaign.id, type: "auto_replenish" },
            });

            if (intent.status === "succeeded") {
              const addedPool = Math.floor(Number(campaign.auto_replenish_amount_usd) * 1000);
              await admin.from("brand_campaigns").update({
                budget_usd: Number(campaign.budget_usd) + Number(campaign.auto_replenish_amount_usd),
                pawbucks_pool: Number(campaign.pawbucks_pool) + addedPool,
                last_auto_replenish_at: new Date().toISOString(),
              }).eq("id", campaign.id);

              if ((campaign.brand_accounts as any).user_id) {
                await admin.from("notifications").insert({
                  user_id: (campaign.brand_accounts as any).user_id,
                  title: "🔋 Campaign Auto-Replenished",
                  message: `"${campaign.name}" was topped up with $${Number(campaign.auto_replenish_amount_usd).toLocaleString()} (${addedPool.toLocaleString()} PB).`,
                  category: "transactional",
                });
              }
              summary.replenished++;
              continue;
            }
          } catch (e) {
            console.error(`Auto-replenish failed for campaign ${campaign.id}:`, e);
            summary.replenish_failed++;
          }
        }
      }

      // Pool exhausted → pause
      if (pctRemaining <= threshold) {
        await admin.from("brand_campaigns").update({
          status: "paused",
          paused_reason: `Pool below ${threshold}% (${remaining.toLocaleString()} PB remaining)`,
          last_guardrail_check_at: new Date().toISOString(),
        }).eq("id", campaign.id);

        if ((campaign.brand_accounts as any).user_id) {
          await admin.from("notifications").insert({
            user_id: (campaign.brand_accounts as any).user_id,
            title: "⏸️ Campaign Paused",
            message: `"${campaign.name}" was paused because the PawBucks pool is nearly depleted. Add funds to resume.`,
            category: "transactional",
          });
        }
        summary.paused_for_pool++;
        continue;
      }

      // Daily cap check
      if (campaign.daily_spend_cap && Number(campaign.daily_spend_cap) > 0) {
        const { data: todayStats } = await admin
          .from("brand_campaign_daily_stats")
          .select("pawbucks_distributed")
          .eq("campaign_id", campaign.id)
          .eq("date", today.toISOString().slice(0, 10))
          .maybeSingle();

        const todayPB = Number(todayStats?.pawbucks_distributed ?? 0);
        const capPB = Number(campaign.daily_spend_cap) * 1000; // cap is USD → PB
        if (todayPB >= capPB) {
          await admin.from("brand_campaigns").update({
            status: "paused",
            paused_reason: `Daily spend cap of $${campaign.daily_spend_cap} reached`,
            last_guardrail_check_at: new Date().toISOString(),
          }).eq("id", campaign.id);

          if ((campaign.brand_accounts as any).user_id) {
            await admin.from("notifications").insert({
              user_id: (campaign.brand_accounts as any).user_id,
              title: "⏸️ Daily Cap Reached",
              message: `"${campaign.name}" hit the daily spend cap of $${campaign.daily_spend_cap}. It will resume tomorrow.`,
              category: "transactional",
            });
          }
          summary.paused_for_daily_cap++;
          continue;
        }
      }

      await admin.from("brand_campaigns").update({
        last_guardrail_check_at: new Date().toISOString(),
      }).eq("id", campaign.id);
    }

    // Auto-resume daily-capped campaigns at midnight UTC: if paused_reason mentions daily cap and the date rolled, resume
    const { data: paused } = await admin
      .from("brand_campaigns")
      .select("id, paused_reason, last_guardrail_check_at")
      .eq("status", "paused")
      .ilike("paused_reason", "%Daily spend cap%");

    for (const p of paused || []) {
      const lastCheck = p.last_guardrail_check_at ? new Date(p.last_guardrail_check_at) : null;
      if (lastCheck && lastCheck < today) {
        await admin.from("brand_campaigns").update({
          status: "active",
          paused_reason: null,
        }).eq("id", p.id);
      }
    }

    return new Response(JSON.stringify({ ok: true, summary }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("brand-campaign-guardrails error:", e);
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message, summary }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
