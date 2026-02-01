import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[WELLNESS-SUBSCRIPTION] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user?.email) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const { planId, petId, pawbucksToUse = 0 } = await req.json();
    if (!planId || !petId) throw new Error("Plan ID and Pet ID are required");

    // Get wellness plan details
    const { data: plan, error: planError } = await supabaseClient
      .from("vet_wellness_plans")
      .select("*, partner_vets(user_id, name, merchant_id)")
      .eq("id", planId)
      .single();

    if (planError || !plan) throw new Error("Wellness plan not found");
    if (!plan.is_active) throw new Error("This wellness plan is no longer available");
    logStep("Plan retrieved", { planName: plan.name, monthlyPrice: plan.monthly_price });

    // Verify pet ownership
    const { data: pet, error: petError } = await supabaseClient
      .from("pet_profiles")
      .select("id, name, user_id")
      .eq("id", petId)
      .eq("user_id", user.id)
      .single();

    if (petError || !pet) throw new Error("Pet not found or you don't own this pet");
    logStep("Pet verified", { petName: pet.name });

    // Check for existing subscription
    const { data: existingSub } = await supabaseClient
      .from("wellness_plan_subscriptions")
      .select("id, status")
      .eq("plan_id", planId)
      .eq("pet_id", petId)
      .in("status", ["active", "pending"])
      .single();

    if (existingSub) throw new Error("This pet is already subscribed to this plan");

    // Calculate amounts
    const monthlyPrice = Number(plan.monthly_price || plan.price_usd);
    const monthlyPriceCents = Math.round(monthlyPrice * 100);
    
    // Calculate PawBucks discount (1000 PB = $1)
    const maxPawbucksValue = monthlyPrice; // Can't use more than the monthly price
    const pawbucksValueUsed = Math.min(pawbucksToUse / 1000, maxPawbucksValue);
    const stripeAmount = Math.max(monthlyPriceCents - Math.round(pawbucksValueUsed * 100), 50); // $0.50 minimum
    
    logStep("Amounts calculated", { monthlyPrice, pawbucksToUse, stripeAmount });

    // Get user's PawBucks balance if using PawBucks
    if (pawbucksToUse > 0) {
      const { data: wallet } = await supabaseClient
        .from("pawbucks_wallet")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!wallet || wallet.balance < pawbucksToUse) {
        throw new Error("Insufficient PawBucks balance");
      }
    }

    // Initialize Stripe
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    // Find or create Stripe customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email,
        metadata: { user_id: user.id },
      });
      customerId = customer.id;
    }
    logStep("Stripe customer ready", { customerId });

    // Create or get Stripe product/price for this plan
    let priceId = plan.stripe_price_id;
    if (!priceId) {
      // Create product
      const product = await stripe.products.create({
        name: `${plan.name} - Wellness Plan`,
        description: plan.description || `Monthly wellness plan from ${plan.partner_vets?.name || 'your vet'}`,
        metadata: { plan_id: planId, vet_id: plan.vet_id },
      });

      // Create recurring price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: monthlyPriceCents,
        currency: "usd",
        recurring: { interval: "month" },
        metadata: { plan_id: planId },
      });

      priceId = price.id;

      // Save to database
      await supabaseClient
        .from("vet_wellness_plans")
        .update({ stripe_product_id: product.id, stripe_price_id: price.id })
        .eq("id", planId);

      logStep("Stripe product/price created", { productId: product.id, priceId });
    }

    // Create checkout session for subscription
    const origin = req.headers.get("origin") || "https://paw-bucks-pay.lovable.app";
    
    const sessionParams: Stripe.Checkout.SessionCreateParams = {
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      success_url: `${origin}/subscription-success?session_id={CHECKOUT_SESSION_ID}&type=wellness&plan_id=${planId}&pet_id=${petId}`,
      cancel_url: `${origin}/vet-dashboard?tab=wellness`,
      metadata: {
        plan_id: planId,
        pet_id: petId,
        user_id: user.id,
        pawbucks_used: pawbucksToUse.toString(),
        type: "wellness_plan",
      },
      subscription_data: {
        metadata: {
          plan_id: planId,
          pet_id: petId,
          user_id: user.id,
          pawbucks_used: pawbucksToUse.toString(),
        },
      },
    };

    // Apply discount if using PawBucks
    if (pawbucksToUse > 0 && pawbucksValueUsed > 0) {
      // Create a coupon for the PawBucks discount
      const coupon = await stripe.coupons.create({
        amount_off: Math.round(pawbucksValueUsed * 100),
        currency: "usd",
        duration: "once",
        name: `PawBucks Discount - ${pawbucksToUse} PB`,
        metadata: { pawbucks_used: pawbucksToUse.toString() },
      });

      sessionParams.discounts = [{ coupon: coupon.id }];
    }

    const session = await stripe.checkout.sessions.create(sessionParams);
    logStep("Checkout session created", { sessionId: session.id });

    // Create pending subscription record
    const nextBillingDate = new Date();
    nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);

    await supabaseClient.from("wellness_plan_subscriptions").insert({
      plan_id: planId,
      user_id: user.id,
      pet_id: petId,
      status: "pending",
      monthly_amount: monthlyPrice,
      next_billing_date: nextBillingDate.toISOString().split("T")[0],
      stripe_customer_id: customerId,
    });

    logStep("Subscription record created (pending)");

    return new Response(JSON.stringify({ url: session.url, sessionId: session.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
