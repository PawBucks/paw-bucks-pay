import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Hardcoded price IDs from the platform account
const SUBSCRIPTION_TIERS = {
  pawpass: {
    price_id: "price_1St3KuHn6eXqpJI78rnXt0UP",
    name: "PawPass",
    amount: 10,
  },
  pawpass_plus: {
    price_id: "price_1St3LbHn6eXqpJI7ZtIFPaKu",
    name: "PawPass+",
    amount: 20,
  },
};

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[ADMIN-UPGRADE-SUBSCRIPTION] ${step}${detailsStr}`);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!stripeKey) {
      throw new Error("STRIPE_SECRET_KEY is not set");
    }

    // Verify authenticated admin user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);

    if (authError || !user) {
      logStep("Authentication failed", authError?.message);
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("User authenticated", { userId: user.id });

    // Use service role for admin checks
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if user is admin or superadmin
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: user.id,
      _role: "admin",
    });

    const { data: isSuperAdmin } = await supabase.rpc("is_superadmin", {
      _user_id: user.id,
    });

    if (!isAdmin && !isSuperAdmin) {
      logStep("User is not admin or superadmin");
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Admin verified", { isAdmin, isSuperAdmin });

    // Parse request body
    const { user_id, tier } = await req.json();

    if (!user_id || !tier) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: user_id and tier" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const validTier = tier as keyof typeof SUBSCRIPTION_TIERS;
    if (validTier !== "pawpass" && validTier !== "pawpass_plus") {
      return new Response(
        JSON.stringify({ error: "Invalid tier. Must be 'pawpass' or 'pawpass_plus'" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Request parsed", { user_id, tier: validTier });
    const tierConfig = SUBSCRIPTION_TIERS[validTier];

    // Get target user's profile
    const { data: targetUser, error: targetUserError } = await supabase
      .from("profiles")
      .select("id, email, full_name, user_type")
      .eq("id", user_id)
      .single();

    if (targetUserError || !targetUser) {
      logStep("Target user not found", targetUserError?.message);
      return new Response(
        JSON.stringify({ error: "User not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (targetUser.user_type !== "pet_owner") {
      return new Response(
        JSON.stringify({ error: "Only pet owners can be upgraded to subscription plans" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Target user found", { email: targetUser.email, name: targetUser.full_name });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Check if user already exists as Stripe customer
    let customerId: string | undefined;
    const customers = await stripe.customers.list({ email: targetUser.email, limit: 1 });

    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing Stripe customer", { customerId });

      // Check if customer already has an active subscription
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: "active",
        limit: 1,
      });

      if (subscriptions.data.length > 0) {
        const existingSub = subscriptions.data[0];
        const existingPriceId = existingSub.items.data[0]?.price.id;
        
        // Check if they're already on this tier
        if (existingPriceId === tierConfig.price_id) {
          return new Response(
            JSON.stringify({ error: `User is already subscribed to ${tierConfig.name}` }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Update existing subscription to new tier
        logStep("Updating existing subscription", { subscriptionId: existingSub.id });
        
        await stripe.subscriptions.update(existingSub.id, {
          items: [
            {
              id: existingSub.items.data[0].id,
              price: tierConfig.price_id,
            },
          ],
          proration_behavior: "create_prorations",
        });

        // Log admin action
        await supabase.rpc("log_admin_action", {
          _action: "UPGRADE_SUBSCRIPTION",
          _entity_type: "subscription",
          _entity_id: user_id,
          _changes: {
            tier,
            tier_name: tierConfig.name,
            action: "upgraded",
            subscription_id: existingSub.id,
          },
        });

        logStep("Subscription upgraded successfully");

        return new Response(
          JSON.stringify({
            success: true,
            message: `User subscription upgraded to ${tierConfig.name}`,
            action: "upgraded",
            subscription_id: existingSub.id,
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Create new customer
      const newCustomer = await stripe.customers.create({
        email: targetUser.email,
        name: targetUser.full_name || undefined,
        metadata: {
          user_id: user_id,
          created_by_admin: user.id,
        },
      });
      customerId = newCustomer.id;
      logStep("Created new Stripe customer", { customerId });
    }

    // Create new subscription (admin-created, no payment method required initially)
    // This creates a subscription that will require payment on the first invoice
    const subscription = await stripe.subscriptions.create({
      customer: customerId,
      items: [{ price: tierConfig.price_id }],
      payment_behavior: "default_incomplete",
      payment_settings: {
        save_default_payment_method: "on_subscription",
      },
      metadata: {
        user_id: user_id,
        created_by_admin: user.id,
        tier: tier,
      },
    });

    logStep("Subscription created", { subscriptionId: subscription.id, status: subscription.status });

    // Log admin action
    await supabase.rpc("log_admin_action", {
      _action: "CREATE_SUBSCRIPTION",
      _entity_type: "subscription",
      _entity_id: user_id,
      _changes: {
        tier,
        tier_name: tierConfig.name,
        action: "created",
        subscription_id: subscription.id,
        status: subscription.status,
      },
    });

    // If the subscription needs payment, get the client secret for the invoice
    let clientSecret: string | null = null;
    if (subscription.status === "incomplete" && subscription.latest_invoice) {
      const invoiceId = typeof subscription.latest_invoice === 'string' 
        ? subscription.latest_invoice 
        : subscription.latest_invoice.id;
      
      const invoice = await stripe.invoices.retrieve(invoiceId);
      if (invoice.payment_intent) {
        const paymentIntentId = typeof invoice.payment_intent === 'string'
          ? invoice.payment_intent
          : invoice.payment_intent.id;
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        clientSecret = paymentIntent.client_secret;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${subscription.status === 'active' ? 'subscribed' : 'subscription created (pending payment)'} to ${tierConfig.name}`,
        action: "created",
        subscription_id: subscription.id,
        status: subscription.status,
        client_secret: clientSecret,
      }),
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
