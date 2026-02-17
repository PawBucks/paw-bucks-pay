import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { transaction_id, user_id, merchant_id } = await req.json();

    if (!transaction_id || !user_id || !merchant_id) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
      );
    }

    // Get all active loyalty programs for this merchant
    const { data: programs, error: progError } = await supabaseAdmin
      .from("merchant_loyalty_programs")
      .select("*")
      .eq("merchant_id", merchant_id)
      .eq("is_active", true);

    if (progError) {
      console.error("Error fetching programs:", progError);
      throw progError;
    }

    if (!programs || programs.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active loyalty programs for this merchant", punches_added: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
      );
    }

    const results = [];

    for (const program of programs) {
      // Check if this transaction already awarded a punch for this program
      const { data: existingPunch } = await supabaseAdmin
        .from("punch_card_events")
        .select("id, punch_card_id!inner(program_id)")
        .eq("transaction_id", transaction_id)
        .limit(100);

      // Filter for this program's punches
      const alreadyPunched = (existingPunch || []).some(
        (e: any) => e.punch_card_id?.program_id === program.id
      );

      if (alreadyPunched) {
        results.push({ program_id: program.id, status: "already_punched" });
        continue;
      }

      // Get or create punch card
      let { data: card } = await supabaseAdmin
        .from("customer_punch_cards")
        .select("*")
        .eq("program_id", program.id)
        .eq("user_id", user_id)
        .maybeSingle();

      if (!card) {
        const { data: newCard, error: createErr } = await supabaseAdmin
          .from("customer_punch_cards")
          .insert({
            program_id: program.id,
            user_id,
            merchant_id,
            current_punches: 0,
            total_punches_earned: 0,
            cards_completed: 0,
          })
          .select()
          .single();

        if (createErr) {
          console.error("Error creating punch card:", createErr);
          results.push({ program_id: program.id, status: "error", error: createErr.message });
          continue;
        }
        card = newCard;
      }

      // Record punch event
      const { error: eventErr } = await supabaseAdmin
        .from("punch_card_events")
        .insert({
          punch_card_id: card.id,
          transaction_id,
          event_type: "punch",
          punches_added: 1,
        });

      if (eventErr) {
        console.error("Error recording punch:", eventErr);
        results.push({ program_id: program.id, status: "error", error: eventErr.message });
        continue;
      }

      // Update punch card
      const newPunches = card.current_punches + 1;
      const newTotalPunches = card.total_punches_earned + 1;
      let newCardsCompleted = card.cards_completed;
      let currentPunchesAfter = newPunches;
      let rewardEarned = false;

      // Check if card is completed
      if (newPunches >= program.punches_required) {
        newCardsCompleted += 1;
        currentPunchesAfter = 0; // Reset for next card
        rewardEarned = true;
      }

      const { error: updateErr } = await supabaseAdmin
        .from("customer_punch_cards")
        .update({
          current_punches: currentPunchesAfter,
          total_punches_earned: newTotalPunches,
          cards_completed: newCardsCompleted,
        })
        .eq("id", card.id);

      if (updateErr) {
        console.error("Error updating punch card:", updateErr);
      }

      // If reward earned, create redemption record
      if (rewardEarned) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 90); // 90 day expiry

        await supabaseAdmin
          .from("loyalty_reward_redemptions")
          .insert({
            punch_card_id: card.id,
            program_id: program.id,
            user_id,
            merchant_id,
            status: "available",
            expires_at: expiresAt.toISOString(),
          });

        // Notify the user
        await supabaseAdmin.from("notifications").insert({
          user_id,
          title: `${program.emoji} Loyalty Reward Earned!`,
          message: `You've completed your ${program.name} punch card! Your reward: ${program.reward_description}`,
          category: "transactional",
        });

        console.log(`User ${user_id} earned reward for program ${program.id}`);
      }

      results.push({
        program_id: program.id,
        status: rewardEarned ? "reward_earned" : "punched",
        current_punches: currentPunchesAfter,
        punches_required: program.punches_required,
        cards_completed: newCardsCompleted,
      });
    }

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error) {
    console.error("Error in loyalty-punch-advance:", error);
    return new Response(
      JSON.stringify({ error: "An unexpected error occurred" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
