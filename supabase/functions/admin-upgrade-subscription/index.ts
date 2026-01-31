import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUBSCRIPTION_TIERS = {
  pawpass: {
    name: "PawPass",
    amount: 10,
  },
  pawpass_plus: {
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
    const { user_id, tier, duration_days } = await req.json();

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

    // Validate duration
    const validDurations = [7, 14, 30, 60, 90, 180, 365];
    const durationDays = duration_days || 30; // Default to 30 days
    if (!validDurations.includes(durationDays)) {
      return new Response(
        JSON.stringify({ error: "Invalid duration. Must be 7, 14, 30, 60, 90, 180, or 365 days" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStep("Request parsed", { user_id, tier: validTier, duration_days: durationDays });
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

    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + durationDays);

    // Check for existing active manual subscription
    const { data: existingSubscription } = await supabase
      .from("subscriptions")
      .select("*")
      .eq("user_id", user_id)
      .eq("is_manual_upgrade", true)
      .eq("status", "active")
      .maybeSingle();

    let subscriptionId: string;
    let action: "created" | "upgraded";

    if (existingSubscription) {
      // Update existing subscription
      const { data: updatedSub, error: updateError } = await supabase
        .from("subscriptions")
        .update({
          subscription_tier: validTier,
          expires_at: expiresAt.toISOString(),
          upgraded_by: user.id,
          reminder_7_days_sent: false,
          reminder_24_hours_sent: false,
          current_period_end: expiresAt.toISOString(),
        })
        .eq("id", existingSubscription.id)
        .select()
        .single();

      if (updateError) {
        throw new Error(`Failed to update subscription: ${updateError.message}`);
      }

      subscriptionId = updatedSub.id;
      action = "upgraded";
      logStep("Existing subscription updated", { subscriptionId });
    } else {
      // Create new manual subscription
      const { data: newSub, error: insertError } = await supabase
        .from("subscriptions")
        .insert({
          user_id: user_id,
          subscription_tier: validTier,
          status: "active",
          is_manual_upgrade: true,
          upgraded_by: user.id,
          expires_at: expiresAt.toISOString(),
          current_period_end: expiresAt.toISOString(),
          start_date: new Date().toISOString(),
        })
        .select()
        .single();

      if (insertError) {
        throw new Error(`Failed to create subscription: ${insertError.message}`);
      }

      subscriptionId = newSub.id;
      action = "created";
      logStep("New subscription created", { subscriptionId });
    }

    // Log subscription event
    await supabase.from("subscription_events").insert({
      subscription_id: subscriptionId,
      event_type: `manual_${action}`,
    });

    // Log admin action
    await supabase.rpc("log_admin_action", {
      _action: action === "created" ? "CREATE_MANUAL_SUBSCRIPTION" : "UPGRADE_MANUAL_SUBSCRIPTION",
      _entity_type: "subscription",
      _entity_id: user_id,
      _changes: {
        tier: validTier,
        tier_name: tierConfig.name,
        duration_days: durationDays,
        expires_at: expiresAt.toISOString(),
        subscription_id: subscriptionId,
      },
    });

    // Send notification to user about their new subscription
    await supabase.from("notifications").insert({
      user_id: user_id,
      title: `You've been upgraded to ${tierConfig.name}!`,
      message: `An administrator has granted you a complimentary ${tierConfig.name} subscription for ${durationDays} days. Enjoy your enhanced rewards!`,
      category: "transactional",
    });

    logStep("Manual subscription completed successfully", { 
      subscriptionId, 
      expiresAt: expiresAt.toISOString(),
      durationDays 
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `User ${action === "created" ? "upgraded" : "subscription updated"} to ${tierConfig.name} for ${durationDays} days`,
        action,
        subscription_id: subscriptionId,
        expires_at: expiresAt.toISOString(),
        duration_days: durationDays,
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
