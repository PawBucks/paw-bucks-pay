import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[LIST-USER-SUBSCRIPTIONS] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

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

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    // Find customer in platform account
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    
    const subscriptions: any[] = [];

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      logStep("Found platform customer", { customerId });

      // Get platform subscriptions (PawPass / PawPass+)
      // Note: Cannot expand more than 4 levels - fetch product separately if needed
      const platformSubs = await stripe.subscriptions.list({
        customer: customerId,
        status: "all",
        limit: 10,
      });

      for (const sub of platformSubs.data) {
        if (sub.status === "canceled") continue; // Skip fully canceled
        
        const priceItem = sub.items.data[0];
        
        // Fetch product name separately to avoid expand depth issues
        let productName = "PawBucks Subscription";
        if (priceItem?.price?.product) {
          try {
            const productId = typeof priceItem.price.product === 'string' 
              ? priceItem.price.product 
              : priceItem.price.product.id;
            const product = await stripe.products.retrieve(productId);
            productName = product.name || productName;
          } catch (e) {
            logStep("Error fetching product", { error: String(e) });
          }
        }
        
        // Safely parse timestamps - Stripe can return Unix timestamps (number) or Date objects
        let currentPeriodEnd: string | null = null;
        let canceledAt: string | null = null;
        
        try {
          if (sub.current_period_end) {
            // Handle both Unix timestamp (number in seconds) and Date-like objects
            if (typeof sub.current_period_end === 'number') {
              currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
            } else if (sub.current_period_end instanceof Date) {
              currentPeriodEnd = sub.current_period_end.toISOString();
            } else if (typeof sub.current_period_end === 'object') {
              // Stripe sometimes returns a date-like object
              const dateValue = sub.current_period_end as any;
              if (typeof dateValue.toISOString === 'function') {
                currentPeriodEnd = dateValue.toISOString();
              } else if (dateValue.seconds) {
                currentPeriodEnd = new Date(dateValue.seconds * 1000).toISOString();
              }
            } else if (typeof sub.current_period_end === 'string') {
              // Already a string, validate it's a valid date
              const parsed = new Date(sub.current_period_end);
              if (!isNaN(parsed.getTime())) {
                currentPeriodEnd = parsed.toISOString();
              }
            }
          }
          logStep("Parsed platform current_period_end", { 
            original: sub.current_period_end, 
            type: typeof sub.current_period_end,
            parsed: currentPeriodEnd 
          });
        } catch (e) {
          logStep("Error parsing current_period_end", { value: sub.current_period_end, error: String(e) });
        }
        
        try {
          if (sub.canceled_at) {
            if (typeof sub.canceled_at === 'number' && sub.canceled_at > 0) {
              canceledAt = new Date(sub.canceled_at * 1000).toISOString();
            } else if (sub.canceled_at instanceof Date) {
              canceledAt = sub.canceled_at.toISOString();
            } else if (typeof sub.canceled_at === 'object') {
              const dateValue = sub.canceled_at as any;
              if (typeof dateValue.toISOString === 'function') {
                canceledAt = dateValue.toISOString();
              }
            } else if (typeof sub.canceled_at === 'string') {
              const parsed = new Date(sub.canceled_at);
              if (!isNaN(parsed.getTime())) {
                canceledAt = parsed.toISOString();
              }
            }
          }
        } catch (e) {
          logStep("Error parsing canceled_at", { value: sub.canceled_at, error: String(e) });
        }
        
        // Skip subscriptions without valid period end date
        if (!currentPeriodEnd) {
          logStep("Skipping subscription with invalid period end", { subId: sub.id });
          continue;
        }
        
        subscriptions.push({
          id: sub.id,
          type: "platform",
          name: productName,
          status: sub.status,
          current_period_end: currentPeriodEnd,
          cancel_at_period_end: sub.cancel_at_period_end,
          canceled_at: canceledAt,
          merchant_name: "PawBucks",
          merchant_id: null,
          connected_account_id: null,
          amount: priceItem?.price?.unit_amount ? priceItem.price.unit_amount / 100 : null,
          currency: priceItem?.price?.currency || "usd",
          interval: priceItem?.price?.recurring?.interval || "month",
        });
      }
    }

    // Get merchant subscriptions via connected accounts
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all merchants with connected Stripe accounts
    const { data: merchants } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, stripe_account_id")
      .not("stripe_account_id", "is", null)
      .eq("stripe_account_status", "active");

    if (merchants && merchants.length > 0) {
      logStep("Checking connected accounts", { count: merchants.length });

      for (const merchant of merchants) {
        try {
          // Search for customer in connected account
          const connectedCustomers = await stripe.customers.list(
            { email: user.email, limit: 1 },
            { stripeAccount: merchant.stripe_account_id }
          );

          if (connectedCustomers.data.length === 0) continue;

          const connectedCustomerId = connectedCustomers.data[0].id;

          // Get subscriptions from connected account
          // Note: Cannot expand more than 4 levels - fetch product separately if needed
          const connectedSubs = await stripe.subscriptions.list(
            {
              customer: connectedCustomerId,
              status: "all",
              limit: 10,
            },
            { stripeAccount: merchant.stripe_account_id }
          );

          for (const sub of connectedSubs.data) {
            if (sub.status === "canceled") continue;

            const priceItem = sub.items.data[0];
            
            // Fetch product name separately to avoid expand depth issues
            let productName = "Merchant Subscription";
            if (priceItem?.price?.product) {
              try {
                const productId = typeof priceItem.price.product === 'string' 
                  ? priceItem.price.product 
                  : priceItem.price.product.id;
                const product = await stripe.products.retrieve(
                  productId, 
                  {}, 
                  { stripeAccount: merchant.stripe_account_id }
                );
                productName = product.name || productName;
              } catch (e) {
                logStep("Error fetching connected product", { error: String(e) });
              }
            }

            // Safely parse timestamps - Stripe can return Unix timestamps (number) or Date objects
            let currentPeriodEnd: string | null = null;
            let canceledAt: string | null = null;
            
            try {
              if (sub.current_period_end) {
                // Handle both Unix timestamp (number in seconds) and Date-like objects
                if (typeof sub.current_period_end === 'number') {
                  currentPeriodEnd = new Date(sub.current_period_end * 1000).toISOString();
                } else if (sub.current_period_end instanceof Date) {
                  currentPeriodEnd = sub.current_period_end.toISOString();
                } else if (typeof sub.current_period_end === 'object') {
                  // Stripe sometimes returns a date-like object with toISOString
                  const dateValue = sub.current_period_end as any;
                  if (typeof dateValue.toISOString === 'function') {
                    currentPeriodEnd = dateValue.toISOString();
                  } else if (dateValue.seconds) {
                    // Firestore-style timestamp
                    currentPeriodEnd = new Date(dateValue.seconds * 1000).toISOString();
                  }
                } else if (typeof sub.current_period_end === 'string') {
                  // Already a string, validate it's a valid date
                  const parsed = new Date(sub.current_period_end);
                  if (!isNaN(parsed.getTime())) {
                    currentPeriodEnd = parsed.toISOString();
                  }
                }
              }
              logStep("Parsed current_period_end", { 
                original: sub.current_period_end, 
                type: typeof sub.current_period_end,
                parsed: currentPeriodEnd 
              });
            } catch (e) {
              logStep("Error parsing merchant sub current_period_end", { value: sub.current_period_end, error: String(e) });
            }
            
            try {
              if (sub.canceled_at) {
                if (typeof sub.canceled_at === 'number' && sub.canceled_at > 0) {
                  canceledAt = new Date(sub.canceled_at * 1000).toISOString();
                } else if (sub.canceled_at instanceof Date) {
                  canceledAt = sub.canceled_at.toISOString();
                } else if (typeof sub.canceled_at === 'object') {
                  const dateValue = sub.canceled_at as any;
                  if (typeof dateValue.toISOString === 'function') {
                    canceledAt = dateValue.toISOString();
                  }
                } else if (typeof sub.canceled_at === 'string') {
                  const parsed = new Date(sub.canceled_at);
                  if (!isNaN(parsed.getTime())) {
                    canceledAt = parsed.toISOString();
                  }
                }
              }
            } catch (e) {
              logStep("Error parsing merchant sub canceled_at", { value: sub.canceled_at, error: String(e) });
            }
            
            // Skip subscriptions without valid period end date
            if (!currentPeriodEnd) {
              logStep("Skipping merchant subscription with invalid period end", { subId: sub.id });
              continue;
            }

            subscriptions.push({
              id: sub.id,
              type: "merchant",
              name: productName,
              status: sub.status,
              current_period_end: currentPeriodEnd,
              cancel_at_period_end: sub.cancel_at_period_end,
              canceled_at: canceledAt,
              merchant_name: merchant.business_name,
              merchant_id: merchant.id,
              connected_account_id: merchant.stripe_account_id,
              amount: priceItem?.price?.unit_amount ? priceItem.price.unit_amount / 100 : null,
              currency: priceItem?.price?.currency || "usd",
              interval: priceItem?.price?.recurring?.interval || "month",
            });
          }
        } catch (err) {
          // Skip merchants with issues
          logStep("Error checking merchant", { merchantId: merchant.id, error: String(err) });
        }
      }
    }

    // === ALSO CHECK DATABASE SUBSCRIPTIONS (merchant_subscriptions table) ===
    // This is critical because our system uses database-tracked subscriptions 
    // (with payment intents) rather than true Stripe subscriptions
    const { data: dbSubscriptions, error: dbSubError } = await supabaseAdmin
      .from("merchant_subscriptions")
      .select(`
        id,
        product_name,
        status,
        current_period_end,
        cancel_at_period_end,
        canceled_at,
        amount,
        currency,
        billing_interval,
        merchant_id,
        connected_account_id,
        merchants(business_name)
      `)
      .eq("user_id", user.id)
      .in("status", ["active", "past_due", "trialing"]);

    if (dbSubError) {
      logStep("Error fetching database subscriptions", { error: dbSubError.message });
    } else if (dbSubscriptions && dbSubscriptions.length > 0) {
      logStep("Found database subscriptions", { count: dbSubscriptions.length });
      
      for (const dbSub of dbSubscriptions) {
        // Check if we already have this subscription from Stripe (avoid duplicates)
        const alreadyExists = subscriptions.some(
          (s) => s.connected_account_id === dbSub.connected_account_id && 
                 s.name === dbSub.product_name
        );
        
        if (alreadyExists) {
          logStep("Skipping duplicate subscription", { productName: dbSub.product_name });
          continue;
        }

        const merchantData = dbSub.merchants as unknown as { business_name: string } | null;
        
        subscriptions.push({
          id: dbSub.id,
          type: "merchant",
          name: dbSub.product_name,
          status: dbSub.status,
          current_period_end: dbSub.current_period_end,
          cancel_at_period_end: dbSub.cancel_at_period_end || false,
          canceled_at: dbSub.canceled_at,
          merchant_name: merchantData?.business_name || "Merchant",
          merchant_id: dbSub.merchant_id,
          connected_account_id: dbSub.connected_account_id,
          amount: dbSub.amount ? dbSub.amount / 100 : null,
          currency: dbSub.currency || "usd",
          interval: dbSub.billing_interval || "month",
        });
      }
    }

    logStep("Subscriptions found", { count: subscriptions.length });

    return new Response(JSON.stringify({ subscriptions }), {
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
