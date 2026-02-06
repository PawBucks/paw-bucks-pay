import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CANCEL-MERCHANT-SUBSCRIPTION] ${step}`, details ? JSON.stringify(details) : "");
};

const cancelSchema = z.object({
  subscriptionId: z.string().uuid(),
  cancelImmediately: z.boolean().optional().default(false),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Authenticate user
    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Parse request
    const body = await req.json();
    const parseResult = cancelSchema.safeParse(body);
    if (!parseResult.success) {
      throw new Error(`Invalid request: ${parseResult.error.message}`);
    }
    const { subscriptionId, cancelImmediately } = parseResult.data;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get subscription and verify ownership
    const { data: subscription, error: subError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select("*, merchants(business_name)")
      .eq("id", subscriptionId)
      .single();

    if (subError || !subscription) {
      throw new Error("Subscription not found");
    }

    if (subscription.user_id !== user.id) {
      throw new Error("Not authorized to cancel this subscription");
    }

    if (subscription.status === "canceled") {
      throw new Error("Subscription is already canceled");
    }

    logStep("Subscription found", { 
      subscriptionId, 
      status: subscription.status,
      cancelImmediately 
    });

    const now = new Date();

    if (cancelImmediately) {
      // Cancel immediately
      await supabaseAdmin
        .from("merchant_subscriptions")
        .update({
          status: "canceled",
          canceled_at: now.toISOString(),
          cancel_at_period_end: false,
        })
        .eq("id", subscriptionId);

      // Log event
      await supabaseAdmin.from("merchant_subscription_events").insert({
        subscription_id: subscriptionId,
        event_type: "canceled",
        metadata: { canceled_immediately: true },
      });

      logStep("Subscription canceled immediately");
    } else {
      // Cancel at period end
      await supabaseAdmin
        .from("merchant_subscriptions")
        .update({
          cancel_at_period_end: true,
        })
        .eq("id", subscriptionId);

      // Log event
      await supabaseAdmin.from("merchant_subscription_events").insert({
        subscription_id: subscriptionId,
        event_type: "canceled",
        metadata: { 
          cancel_at_period_end: true,
          effective_date: subscription.current_period_end,
        },
      });

      logStep("Subscription set to cancel at period end", { 
        effectiveDate: subscription.current_period_end 
      });
    }

    // Send notification
    const merchantName = subscription.merchants?.business_name || "the merchant";
    await supabaseAdmin.from("notifications").insert({
      user_id: user.id,
      title: "Subscription Canceled",
      message: cancelImmediately
        ? `Your subscription to ${subscription.product_name} from ${merchantName} has been canceled.`
        : `Your subscription to ${subscription.product_name} from ${merchantName} will be canceled at the end of your current billing period.`,
      category: "transactional",
    });

    return new Response(JSON.stringify({
      success: true,
      subscriptionId,
      status: cancelImmediately ? "canceled" : subscription.status,
      cancelAtPeriodEnd: !cancelImmediately,
      effectiveDate: cancelImmediately ? now.toISOString() : subscription.current_period_end,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
