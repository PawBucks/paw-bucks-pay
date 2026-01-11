import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[CANCEL-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const { subscription_id, connected_account_id, cancel_immediately } = await req.json();
    
    if (!subscription_id) {
      throw new Error("subscription_id is required");
    }

    logStep("Request params", { subscription_id, connected_account_id, cancel_immediately });

    // Authenticate user
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Verify the subscription belongs to this user
    let subscription: Stripe.Subscription;
    
    if (connected_account_id) {
      // Merchant subscription - verify ownership via connected account
      subscription = await stripe.subscriptions.retrieve(
        subscription_id,
        { expand: ["customer"] },
        { stripeAccount: connected_account_id }
      );
      
      const customer = subscription.customer as Stripe.Customer;
      if (customer.email !== user.email) {
        throw new Error("This subscription does not belong to you");
      }
    } else {
      // Platform subscription - verify ownership
      subscription = await stripe.subscriptions.retrieve(subscription_id, {
        expand: ["customer"],
      });
      
      const customer = subscription.customer as Stripe.Customer;
      if (customer.email !== user.email) {
        throw new Error("This subscription does not belong to you");
      }
    }

    logStep("Subscription verified", { subscriptionId: subscription.id, status: subscription.status });

    // Cancel the subscription
    let updatedSubscription: Stripe.Subscription;
    
    if (cancel_immediately) {
      // Cancel immediately
      if (connected_account_id) {
        updatedSubscription = await stripe.subscriptions.cancel(
          subscription_id,
          {},
          { stripeAccount: connected_account_id }
        );
      } else {
        updatedSubscription = await stripe.subscriptions.cancel(subscription_id);
      }
      logStep("Subscription canceled immediately");
    } else {
      // Cancel at period end
      if (connected_account_id) {
        updatedSubscription = await stripe.subscriptions.update(
          subscription_id,
          { cancel_at_period_end: true },
          { stripeAccount: connected_account_id }
        );
      } else {
        updatedSubscription = await stripe.subscriptions.update(subscription_id, {
          cancel_at_period_end: true,
        });
      }
      logStep("Subscription set to cancel at period end");
    }

    return new Response(
      JSON.stringify({
        success: true,
        subscription: {
          id: updatedSubscription.id,
          status: updatedSubscription.status,
          cancel_at_period_end: updatedSubscription.cancel_at_period_end,
          current_period_end: new Date(updatedSubscription.current_period_end * 1000).toISOString(),
        },
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
