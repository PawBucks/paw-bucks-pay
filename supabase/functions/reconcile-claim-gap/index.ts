import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[RECONCILE-CLAIM] ${step}${detailsStr}`);
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
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    const { sliceId, action, option } = await req.json();

    if (!sliceId || !action) {
      throw new Error("sliceId and action are required");
    }

    // Get the slice details
    const { data: slice, error: sliceError } = await supabaseClient
      .from("invoice_slices")
      .select(
        `
        *,
        invoice:invoices(
          id,
          invoice_number,
          client_name,
          client_email,
          merchant_id,
          total
        ),
        claim:insurance_claims(
          id,
          claim_number,
          total_amount,
          policy:pet_insurance_policies(
            pet:pet_profiles(name, user_id),
            vet_insurance_providers(name)
          )
        )
      `
      )
      .eq("id", sliceId)
      .single();

    if (sliceError || !slice) {
      throw new Error("Slice not found");
    }

    logStep("Slice retrieved", { sliceId, gapAmount: slice.gap_amount });

    let result: Record<string, unknown> = {};

    switch (action) {
      case "notify_owner": {
        // Get owner's user_id from the pet profile
        const ownerId = slice.claim?.policy?.pet?.user_id;
        if (!ownerId) {
          throw new Error("Could not find pet owner for this claim");
        }

        // Create notification for the owner
        const { error: notifError } = await supabaseClient.from("notifications").insert({
          user_id: ownerId,
          title: "Insurance Payment Update",
          message: `Your insurance carrier paid less than expected for ${slice.claim?.policy?.pet?.name}'s visit. A balance of $${Number(slice.gap_amount).toFixed(2)} is due.`,
          category: "transactional",
        });

        if (notifError) {
          logStep("Notification creation failed", { error: notifError.message });
        }

        // Update slice status
        await supabaseClient
          .from("invoice_slices")
          .update({
            recovery_status: "notification_sent",
            notification_sent_at: new Date().toISOString(),
          })
          .eq("id", sliceId);

        // Log the action
        await supabaseClient.from("claim_recovery_log").insert({
          slice_id: sliceId,
          action: "notification_sent",
          actor_type: "vet",
          actor_id: user.id,
          details: { owner_id: ownerId, gap_amount: slice.gap_amount },
        });

        result = { success: true, action: "notification_sent", ownerId };
        logStep("Owner notification sent", { ownerId });
        break;
      }

      case "select_option": {
        if (!option) {
          throw new Error("Option is required for select_option action");
        }

        // Update slice with selected option
        await supabaseClient
          .from("invoice_slices")
          .update({
            recovery_status: "option_selected",
            recovery_option: option,
            option_selected_at: new Date().toISOString(),
          })
          .eq("id", sliceId);

        // Log the action
        await supabaseClient.from("claim_recovery_log").insert({
          slice_id: sliceId,
          action: `option_selected_${option}`,
          actor_type: "owner",
          actor_id: user.id,
          details: { option, gap_amount: slice.gap_amount },
        });

        // Handle specific options
        if (option === "pawbucks") {
          // Deduct PawBucks from owner's wallet
          const pawBucksNeeded = Math.ceil(Number(slice.gap_amount) * 1000);

          const { data: wallet, error: walletError } = await supabaseClient
            .from("pawbucks_wallet")
            .select("balance")
            .eq("user_id", user.id)
            .single();

          if (walletError || !wallet || wallet.balance < pawBucksNeeded) {
            throw new Error("Insufficient PawBucks balance");
          }

          // Deduct from wallet
          await supabaseClient
            .from("pawbucks_wallet")
            .update({ balance: wallet.balance - pawBucksNeeded })
            .eq("user_id", user.id);

          // Log activity
          await supabaseClient.from("pawbucks_activity").insert({
            user_id: user.id,
            type: "redeem",
            amount: -pawBucksNeeded,
            description: `Claim gap payment for ${slice.claim?.claim_number || "claim"}`,
            source: "claim_recovery",
          });

          // Mark as funded and release rewards
          await supabaseClient
            .from("invoice_slices")
            .update({
              recovery_status: "funded",
              funded_at: new Date().toISOString(),
            })
            .eq("id", sliceId);

          // Release locked rewards
          await releaseLockedRewards(supabaseClient, user.id, slice, sliceId);

          result = { success: true, option: "pawbucks", pawBucksUsed: pawBucksNeeded };
          logStep("PawBucks payment processed", { pawBucksUsed: pawBucksNeeded });
        } else if (option === "payment_plan") {
          // Create payment plan (3 installments)
          const totalAmount = Number(slice.gap_amount);
          const installmentAmount = Math.ceil((totalAmount / 3) * 100) / 100;
          const nextDueDate = new Date();
          nextDueDate.setMonth(nextDueDate.getMonth() + 1);

          await supabaseClient.from("claim_payment_plans").insert({
            slice_id: sliceId,
            owner_id: user.id,
            total_amount: totalAmount,
            installments: 3,
            installment_amount: installmentAmount,
            next_due_date: nextDueDate.toISOString().split("T")[0],
          });

          // Update slice status to funded (plan created)
          await supabaseClient
            .from("invoice_slices")
            .update({
              recovery_status: "funded",
              funded_at: new Date().toISOString(),
            })
            .eq("id", sliceId);

          // Release locked rewards since payment plan is committed
          await releaseLockedRewards(supabaseClient, user.id, slice, sliceId);

          result = {
            success: true,
            option: "payment_plan",
            installments: 3,
            installmentAmount,
          };
          logStep("Payment plan created", { installments: 3, installmentAmount });
        } else if (option === "pay_now") {
          // For pay_now, the frontend will redirect to payment
          // We just log and mark status
          result = {
            success: true,
            option: "pay_now",
            amount: slice.gap_amount,
            invoiceId: slice.invoice?.id,
          };
          logStep("Pay now option selected", { amount: slice.gap_amount });
        }
        break;
      }

      case "mark_funded": {
        // Mark slice as funded after successful card payment
        await supabaseClient
          .from("invoice_slices")
          .update({
            recovery_status: "funded",
            funded_at: new Date().toISOString(),
          })
          .eq("id", sliceId);

        // Log the action
        await supabaseClient.from("claim_recovery_log").insert({
          slice_id: sliceId,
          action: "payment_completed",
          actor_type: "owner",
          actor_id: user.id,
          details: { gap_amount: slice.gap_amount, payment_method: "card" },
        });

        // Release locked rewards
        await releaseLockedRewards(supabaseClient, user.id, slice, sliceId);

        result = { success: true, action: "funded" };
        logStep("Slice marked as funded");
        break;
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    logStep("Function completed successfully", result);

    return new Response(JSON.stringify(result), {
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

// Helper function to release locked rewards
async function releaseLockedRewards(
  supabaseClient: any,
  userId: string,
  slice: Record<string, unknown>,
  sliceId: string
) {
  try {
    // Find existing locked rewards linked to this slice
    const { data: lockedRewards, error: lockedError } = await supabaseClient
      .from("pawbucks_activity")
      .select("id, amount, user_id")
      .eq("slice_id", sliceId)
      .eq("pawbucks_status", "pending")
      .eq("type", "credit");

    if (lockedError) {
      console.error("[RECONCILE-CLAIM] Error fetching locked rewards:", lockedError);
    }

    if (lockedRewards && lockedRewards.length > 0) {
      // Release the locked rewards by updating their status
      const totalToRelease = lockedRewards.reduce((sum: number, r: any) => sum + r.amount, 0);
      const rewardOwnerId = lockedRewards[0].user_id;

      // Update the pending rewards to available
      for (const reward of lockedRewards) {
        await supabaseClient
          .from("pawbucks_activity")
          .update({ 
            pawbucks_status: "available",
            description: reward.description?.replace("Pending insurance", "Claim resolved") || "Rewards released for resolved claim"
          })
          .eq("id", reward.id);
      }

      // Credit the rewards to the user's wallet
      const { data: wallet } = await supabaseClient
        .from("pawbucks_wallet")
        .select("balance")
        .eq("user_id", rewardOwnerId)
        .single();

      const currentBalance = wallet?.balance || 0;

      await supabaseClient
        .from("pawbucks_wallet")
        .update({ balance: currentBalance + totalToRelease })
        .eq("user_id", rewardOwnerId);

      // Log in claim recovery log
      await supabaseClient.from("claim_recovery_log").insert({
        slice_id: sliceId,
        action: "rewards_released",
        actor_type: "system",
        actor_id: rewardOwnerId,
        details: { 
          rewards_amount: totalToRelease, 
          locked_reward_count: lockedRewards.length,
        },
      });

      console.log(`[RECONCILE-CLAIM] Released ${totalToRelease} locked PawBucks to user ${rewardOwnerId}`);
      return;
    }

    // Fallback: If no locked rewards found, calculate and create new ones
    // Get user's subscription tier to calculate rewards
    const { data: subData } = await supabaseClient
      .from("user_subscriptions")
      .select("tier")
      .eq("user_id", userId)
      .eq("status", "active")
      .maybeSingle();

    const tier = subData?.tier || "free";
    const multiplier = tier === "pawpass_plus" ? 30 : tier === "pawpass" ? 20 : 10;
    
    // Calculate rewards based on original transaction amount
    const originalAmount = Number((slice as { original_amount?: number }).original_amount) || 0;
    const rewardsToRelease = Math.floor(originalAmount * multiplier);

    if (rewardsToRelease > 0) {
      // Credit the rewards to user's wallet
      const { data: wallet } = await supabaseClient
        .from("pawbucks_wallet")
        .select("balance")
        .eq("user_id", userId)
        .single();

      const currentBalance = wallet?.balance || 0;

      await supabaseClient
        .from("pawbucks_wallet")
        .update({ balance: currentBalance + rewardsToRelease })
        .eq("user_id", userId);

      // Log the reward release
      await supabaseClient.from("pawbucks_activity").insert({
        user_id: userId,
        type: "earn",
        amount: rewardsToRelease,
        description: `Rewards released for resolved claim`,
        source: "claim_recovery_reward",
        pawbucks_status: "available",
      });

      // Log in claim recovery log
      await supabaseClient.from("claim_recovery_log").insert({
        slice_id: sliceId,
        action: "rewards_released",
        actor_type: "system",
        actor_id: userId,
        details: { rewards_amount: rewardsToRelease, multiplier, original_amount: originalAmount },
      });

      console.log(`[RECONCILE-CLAIM] Released ${rewardsToRelease} PawBucks to user ${userId}`);
    }
  } catch (error) {
    console.error("[RECONCILE-CLAIM] Error releasing rewards:", error);
    // Don't throw - reward release failure shouldn't block the main flow
  }
}
