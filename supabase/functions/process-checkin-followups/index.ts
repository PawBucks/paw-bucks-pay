import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

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

    return new Response(JSON.stringify({ processed }), {
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
