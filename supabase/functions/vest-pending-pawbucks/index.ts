import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting vesting scheduler...");

    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Get all pending PawBucks that should be vested
    const { data: pendingActivities, error: fetchError } = await supabaseAdmin
      .from("pawbucks_activity")
      .select("id, user_id, amount, description")
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

    // Group activities by user
    const userActivities = new Map<string, { amount: number; ids: string[] }>();
    for (const activity of pendingActivities) {
      const current = userActivities.get(activity.user_id) || { amount: 0, ids: [] };
      current.amount += activity.amount;
      current.ids.push(activity.id);
      userActivities.set(activity.user_id, current);
    }

    let vestedCount = 0;
    const errors: string[] = [];

    // Process each user
    for (const [userId, { amount, ids }] of userActivities) {
      try {
        // Update activity status to available
        const { error: updateError } = await supabaseAdmin
          .from("pawbucks_activity")
          .update({ pawbucks_status: "available" })
          .in("id", ids);

        if (updateError) {
          console.error(`Error updating activities for user ${userId}:`, updateError);
          errors.push(`User ${userId}: ${updateError.message}`);
          continue;
        }

        // Update user's wallet balance
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

        // Send notification to user
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
