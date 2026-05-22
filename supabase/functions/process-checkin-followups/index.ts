import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders }
);
  }

  const _authResp = checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Find all pending follow-ups where notify_at has passed
    const { data: pendingFollowups, error: fetchError } = await supabase
      .from("checkin_followups")
      .select("id, user_id, entity_name, merchant_id, vet_id, attempt_number")
      .eq("status", "pending")
      .lte("notify_at", new Date().toISOString());

    if (fetchError) throw fetchError;

    if (!pendingFollowups || pendingFollowups.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let processed = 0;

    for (const followup of pendingFollowups) {
      // Check if user made a purchase since check-in (look for transactions)
      const { data: recentTx } = await supabase
        .from("transactions")
        .select("id")
        .eq("user_id", followup.user_id)
        .eq("status", "completed")
        .or(
          followup.merchant_id
            ? `merchant_id.eq.${followup.merchant_id}`
            : `merchant_id.is.null`
        )
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      // Also check for provisional credits from checkin flow
      const { data: provisionalCredit } = await supabase
        .from("pawbucks_activity")
        .select("id")
        .eq("user_id", followup.user_id)
        .eq("source", "checkin_provisional")
        .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .limit(1);

      if ((recentTx && recentTx.length > 0) || (provisionalCredit && provisionalCredit.length > 0)) {
        // Purchase or provisional credit found — mark as answered automatically
        await supabase
          .from("checkin_followups")
          .update({ status: "answered", response: "yes", answered_at: new Date().toISOString() })
          .eq("id", followup.id);
        processed++;
        continue;
      }

      // Send notification to user
      const attemptLabel = followup.attempt_number > 1 ? ` (follow-up #${followup.attempt_number})` : "";
      await supabase.from("notifications").insert({
        user_id: followup.user_id,
        title: `Did you make a purchase at ${followup.entity_name}?`,
        message: `We noticed you checked in at ${followup.entity_name} today. Did you make a purchase?${attemptLabel}`,
        category: "transactional",
        link_url: "/dashboard",
      });

      // Mark as notified
      await supabase
        .from("checkin_followups")
        .update({ status: "notified", notified_at: new Date().toISOString() })
        .eq("id", followup.id);

      processed++;
    }

    // --- 24-hour receipt reminder for answered "yes" followups ---
    let reminders = 0;
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();

    // Find followups answered "yes" 24-48h ago that have provisional credit but no receipt
    const { data: unverifiedFollowups } = await supabase
      .from("checkin_followups")
      .select("id, user_id, entity_name")
      .eq("status", "answered")
      .eq("response", "yes")
      .lte("answered_at", twentyFourHoursAgo)
      .gte("answered_at", fortyEightHoursAgo);

    if (unverifiedFollowups && unverifiedFollowups.length > 0) {
      for (const fu of unverifiedFollowups) {
        // Check if a receipt was already submitted for this user in the last 48h
        const { data: receipts } = await supabase
          .from("receipt_submissions")
          .select("id")
          .eq("user_id", fu.user_id)
          .gte("created_at", fortyEightHoursAgo)
          .limit(1);

        if (receipts && receipts.length > 0) continue;

        // Check if we already sent a receipt reminder for this followup
        const { data: existingReminder } = await supabase
          .from("notifications")
          .select("id")
          .eq("user_id", fu.user_id)
          .like("title", "%receipt to unlock%")
          .gte("created_at", fortyEightHoursAgo)
          .limit(1);

        if (existingReminder && existingReminder.length > 0) continue;

        // Get the provisional PB amount
        const { data: provisionalPB } = await supabase
          .from("pawbucks_activity")
          .select("amount")
          .eq("user_id", fu.user_id)
          .eq("source", "checkin_provisional")
          .eq("pawbucks_status", "pending")
          .gte("created_at", fortyEightHoursAgo)
          .limit(1)
          .single();

        const pbAmount = provisionalPB?.amount ?? 0;

        await supabase.from("notifications").insert({
          user_id: fu.user_id,
          title: `Upload your receipt to unlock +${pbAmount.toLocaleString()} PawBucks`,
          message: `You've got ${pbAmount.toLocaleString()} PawBucks waiting from ${fu.entity_name} — upload your receipt to unlock it before it expires.`,
          category: "transactional",
          link_url: "/dashboard",
        });

        reminders++;
      }
    }

    return new Response(JSON.stringify({ processed, reminders }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error processing check-in follow-ups:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
