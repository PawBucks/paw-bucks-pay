import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/**
 * Get the current midnight boundary in a user's timezone, returned as a UTC ISO string.
 * This ensures vesting happens at midnight in the user's local time, not UTC.
 */
function getMidnightInTz(tz: string): string {
  const now = new Date();
  // Get today's date in user's timezone
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' });
  const dateStr = formatter.format(now); // YYYY-MM-DD
  // Tomorrow midnight in user's tz
  const [y, m, d] = dateStr.split('-').map(Number);
  // Create "today at midnight" in user's tz and convert to UTC
  const utcStr = new Date(`${dateStr}T00:00:00Z`).toLocaleString('en-US', { timeZone: 'UTC' });
  const tzStr = new Date(`${dateStr}T00:00:00Z`).toLocaleString('en-US', { timeZone: tz });
  const offset = new Date(utcStr).getTime() - new Date(tzStr).getTime();
  // End of today (start of tomorrow) in user's tz
  const tomorrowMidnight = new Date(new Date(`${y}-${String(m).padStart(2,'0')}-${String(d+1).padStart(2,'0')}T00:00:00Z`).getTime() + offset);
  return tomorrowMidnight.toISOString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting vesting scheduler...");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all pending PawBucks that should be vested
    // We fetch all that have vest_date <= now, then for each user we check
    // if it's past midnight in their local timezone
    const { data: pendingActivities, error: fetchError } = await supabaseAdmin
      .from("pawbucks_activity")
      .select("id, user_id, amount, description, vest_date")
      .eq("pawbucks_status", "pending")
      .lte("vest_date", new Date().toISOString());

    if (fetchError) {
      console.error("Error fetching pending activities:", fetchError);
      throw fetchError;
    }

    if (!pendingActivities || pendingActivities.length === 0) {
      console.log("No pending PawBucks to vest");
      return new Response(
        JSON.stringify({ success: true, vested: 0, message: "No pending PawBucks to vest" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${pendingActivities.length} pending activities to vest`);

    // Get unique user IDs to fetch their timezones
    const uniqueUserIds = [...new Set(pendingActivities.map(a => a.user_id))];
    const { data: profiles } = await supabaseAdmin
      .from("profiles")
      .select("id, timezone")
      .in("id", uniqueUserIds);

    const userTzMap = new Map<string, string>();
    for (const p of profiles || []) {
      userTzMap.set(p.id, p.timezone || 'America/New_York');
    }

    // Filter: only vest if it's past midnight in the user's local timezone on the vest_date
    const now = new Date();
    const eligibleActivities = pendingActivities.filter(activity => {
      const tz = userTzMap.get(activity.user_id) || 'America/New_York';
      // Get "now" in user's timezone as a date string
      const nowInTz = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' })
        .format(now);
      const vestDate = activity.vest_date?.split('T')[0];
      // Vest if the user's local date is >= vest_date
      return !vestDate || nowInTz >= vestDate;
    });

    // Group activities by user
    const userActivities = new Map<string, { amount: number; ids: string[] }>();
    for (const activity of eligibleActivities) {
      const current = userActivities.get(activity.user_id) || { amount: 0, ids: [] };
      current.amount += activity.amount;
      current.ids.push(activity.id);
      userActivities.set(activity.user_id, current);
    }

    let vestedCount = 0;
    const errors: string[] = [];

    for (const [userId, { amount, ids }] of userActivities) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from("pawbucks_activity")
          .update({ pawbucks_status: "available" })
          .in("id", ids);

        if (updateError) {
          console.error(`Error updating activities for user ${userId}:`, updateError);
          errors.push(`User ${userId}: ${updateError.message}`);
          continue;
        }

        const { data: wallet, error: walletError } = await supabaseAdmin
          .from("pawbucks_wallet")
          .select("balance")
          .eq("user_id", userId)
          .single();

        if (walletError || !wallet) {
          console.error(`Wallet not found for user ${userId}:`, walletError);
          errors.push(`User ${userId}: Wallet not found`);
          continue;
        }

        const newBalance = wallet.balance + amount;
        const { error: balanceError } = await supabaseAdmin
          .from("pawbucks_wallet")
          .update({ 
            balance: newBalance, 
            last_updated: new Date().toISOString() 
          })
          .eq("user_id", userId);

        if (balanceError) {
          console.error(`Error updating balance for user ${userId}:`, balanceError);
          errors.push(`User ${userId}: ${balanceError.message}`);
          continue;
        }

        await supabaseAdmin.from("notifications").insert({
          user_id: userId,
          title: "PawBucks Now Available! 🎉",
          message: `${amount} PawBucks have completed their 30-day vesting period and are now available to redeem!`,
          category: "rewards",
        });

        vestedCount += ids.length;
        console.log(`Vested ${ids.length} activities (${amount} PB) for user ${userId}`);
      } catch (error) {
        console.error(`Error processing user ${userId}:`, error);
        errors.push(`User ${userId}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    console.log(`Vesting complete. Vested: ${vestedCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        vested: vestedCount,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully vested ${vestedCount} PawBucks activities`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Vesting scheduler error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
