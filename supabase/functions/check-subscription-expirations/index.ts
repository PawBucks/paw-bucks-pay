import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version, x-internal-secret",
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CHECK-SUBSCRIPTION-EXPIRATIONS] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }
  const _authResp = checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;
);
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    // 1. Handle expired subscriptions - revert to free
    const { data: expiredSubs, error: expiredError } = await supabase
      .from("subscriptions")
      .select("id, user_id, subscription_tier")
      .eq("is_manual_upgrade", true)
      .eq("status", "active")
      .lt("expires_at", now.toISOString());

    if (expiredError) {
      throw new Error(`Failed to fetch expired subscriptions: ${expiredError.message}`);
    }

    logStep("Found expired subscriptions", { count: expiredSubs?.length || 0 });

    for (const sub of expiredSubs || []) {
      // Update subscription to expired
      await supabase
        .from("subscriptions")
        .update({
          status: "expired",
          subscription_tier: "free",
        })
        .eq("id", sub.id);

      // Log event
      await supabase.from("subscription_events").insert({
        subscription_id: sub.id,
        event_type: "manual_expired",
      });

      // Notify user
      await supabase.from("notifications").insert({
        user_id: sub.user_id,
        title: "Your subscription has expired",
        message: "Your complimentary subscription has ended. Upgrade to PawPass or PawPass+ to continue enjoying enhanced rewards!",
        category: "transactional",
      });

      logStep("Expired subscription processed", { subscriptionId: sub.id, userId: sub.user_id });
    }

    // 2. Send 7-day reminders
    const { data: sevenDayReminders, error: sevenDayError } = await supabase
      .from("subscriptions")
      .select("id, user_id, subscription_tier, expires_at")
      .eq("is_manual_upgrade", true)
      .eq("status", "active")
      .eq("reminder_7_days_sent", false)
      .gt("expires_at", now.toISOString())
      .lte("expires_at", sevenDaysFromNow.toISOString());

    if (sevenDayError) {
      throw new Error(`Failed to fetch 7-day reminders: ${sevenDayError.message}`);
    }

    logStep("Found 7-day reminder candidates", { count: sevenDayReminders?.length || 0 });

    for (const sub of sevenDayReminders || []) {
      const expiresDate = new Date(sub.expires_at).toLocaleDateString();
      const tierName = sub.subscription_tier === "pawpass_plus" ? "PawPass+" : "PawPass";

      // Check user notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("transactional")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      const shouldNotify = prefs?.transactional !== false;

      if (shouldNotify) {
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "Your subscription expires in 7 days",
          message: `Your complimentary ${tierName} subscription will expire on ${expiresDate}. Upgrade now to keep your enhanced rewards!`,
          category: "transactional",
        });
      }

      // Mark reminder as sent
      await supabase
        .from("subscriptions")
        .update({ reminder_7_days_sent: true })
        .eq("id", sub.id);

      logStep("7-day reminder sent", { subscriptionId: sub.id, userId: sub.user_id });
    }

    // 3. Send 24-hour reminders
    const { data: oneDayReminders, error: oneDayError } = await supabase
      .from("subscriptions")
      .select("id, user_id, subscription_tier, expires_at")
      .eq("is_manual_upgrade", true)
      .eq("status", "active")
      .eq("reminder_24_hours_sent", false)
      .gt("expires_at", now.toISOString())
      .lte("expires_at", oneDayFromNow.toISOString());

    if (oneDayError) {
      throw new Error(`Failed to fetch 24-hour reminders: ${oneDayError.message}`);
    }

    logStep("Found 24-hour reminder candidates", { count: oneDayReminders?.length || 0 });

    for (const sub of oneDayReminders || []) {
      const tierName = sub.subscription_tier === "pawpass_plus" ? "PawPass+" : "PawPass";

      // Check user notification preferences
      const { data: prefs } = await supabase
        .from("notification_preferences")
        .select("transactional")
        .eq("user_id", sub.user_id)
        .maybeSingle();

      const shouldNotify = prefs?.transactional !== false;

      if (shouldNotify) {
        await supabase.from("notifications").insert({
          user_id: sub.user_id,
          title: "Your subscription expires tomorrow!",
          message: `Your complimentary ${tierName} subscription expires in less than 24 hours. Upgrade now to avoid losing your enhanced rewards!`,
          category: "transactional",
        });
      }

      // Mark reminder as sent
      await supabase
        .from("subscriptions")
        .update({ reminder_24_hours_sent: true })
        .eq("id", sub.id);

      logStep("24-hour reminder sent", { subscriptionId: sub.id, userId: sub.user_id });
    }

    const summary = {
      expired_count: expiredSubs?.length || 0,
      seven_day_reminders: sevenDayReminders?.length || 0,
      one_day_reminders: oneDayReminders?.length || 0,
    };

    logStep("Processing complete", summary);

    return new Response(
      JSON.stringify({ success: true, ...summary }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
