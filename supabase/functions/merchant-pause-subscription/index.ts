import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[MERCHANT-PAUSE-SUBSCRIPTION] ${step}`, details ? JSON.stringify(details) : "");
};

const schema = z.object({
  subscriptionId: z.string().uuid(),
  action: z.enum(["pause", "resume"]),
  reason: z.string().trim().min(3, "Reason is required").max(500),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    const parsed = schema.safeParse(await req.json());
    if (!parsed.success) {
      throw new Error(parsed.error.errors.map((e) => e.message).join(", "));
    }
    const { subscriptionId, action, reason } = parsed.data;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const { data: subscription, error: subError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("*, merchants(business_name, user_id)")
      .eq("id", subscriptionId)
      .single();
    if (subError || !subscription) throw new Error("Subscription not found");

    if (subscription.merchants?.user_id !== user.id) {
      const { data: vetData } = await supabaseAdmin
        .from("partner_vets")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();
      if (!vetData) throw new Error("Not authorized to modify this subscription");
    }

    if (subscription.status === "canceled") {
      throw new Error("Cannot modify a canceled subscription");
    }

    const merchantName = subscription.merchants?.business_name || "the merchant";

    if (action === "pause") {
      if (subscription.status === "paused") throw new Error("Subscription is already paused");
      await supabaseAdmin
        .from("merchant_subscriptions")
        .update({ status: "paused" })
        .eq("id", subscriptionId);

      await supabaseAdmin.from("merchant_subscription_events").insert({
        subscription_id: subscriptionId,
        event_type: "paused",
        metadata: {
          paused_by: "merchant",
          paused_by_user_id: user.id,
          reason,
          previous_status: subscription.status,
        },
      });

      await supabaseAdmin.from("notifications").insert({
        user_id: subscription.user_id,
        title: "Subscription Paused",
        message: `Your subscription to ${subscription.product_name} from ${merchantName} has been paused. Reason: ${reason}. You will not be billed while paused.`,
        category: "transactional",
      });

      logStep("Subscription paused", { subscriptionId });
    } else {
      if (subscription.status !== "paused") throw new Error("Subscription is not paused");

      // If the scheduled billing date elapsed while paused, roll it forward so the
      // customer is not immediately charged for the paused period (and is not charged
      // twice — once on resume and again on the stale date).
      const interval = subscription.billing_interval || "month";
      const intervalCount = Number(subscription.billing_interval_count || 1) || 1;
      const advance = (from: Date) => {
        const d = new Date(from);
        if (interval === "year") d.setUTCFullYear(d.getUTCFullYear() + intervalCount);
        else if (interval === "week") d.setUTCDate(d.getUTCDate() + 7 * intervalCount);
        else if (interval === "day") d.setUTCDate(d.getUTCDate() + intervalCount);
        else d.setUTCMonth(d.getUTCMonth() + intervalCount);
        return d;
      };

      const now = new Date();
      const update: Record<string, unknown> = { status: "active" };
      let due = subscription.next_billing_date ? new Date(subscription.next_billing_date) : null;
      if (due && due.getTime() <= now.getTime()) {
        let periodStart = due;
        while (due.getTime() <= now.getTime()) {
          periodStart = due;
          due = advance(due);
        }
        update.current_period_start = periodStart.toISOString();
        update.current_period_end = due.toISOString();
        update.next_billing_date = due.toISOString();
      }

      await supabaseAdmin
        .from("merchant_subscriptions")
        .update(update)
        .eq("id", subscriptionId);

      await supabaseAdmin.from("merchant_subscription_events").insert({
        subscription_id: subscriptionId,
        event_type: "resumed",
        metadata: {
          resumed_by: "merchant",
          resumed_by_user_id: user.id,
          reason,
        },
      });

      await supabaseAdmin.from("notifications").insert({
        user_id: subscription.user_id,
        title: "Subscription Resumed",
        message: `Your subscription to ${subscription.product_name} from ${merchantName} has been resumed. Reason: ${reason}. Billing will continue on your next scheduled date.`,
        category: "transactional",
      });

      logStep("Subscription resumed", { subscriptionId });
    }

    return new Response(
      JSON.stringify({ success: true, subscriptionId, action }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});