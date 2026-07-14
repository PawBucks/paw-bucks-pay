import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : "";
  console.log(`[DENY-CLAIM] ${step}${detailsStr}`);
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

    // Authenticate vet user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: userError,
    } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    if (!user) throw new Error("User not authenticated");

    logStep("Vet user authenticated", { userId: user.id });

    // Verify caller is a registered vet, and later confirm they own the claim
    const { data: vet, error: vetError } = await supabaseClient
      .from("partner_vets")
      .select("id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (vetError || !vet) {
      throw new Error("You must be a registered vet to deny claims");
    }

    const { claimId, denialReason } = await req.json();

    if (!claimId) {
      throw new Error("claimId is required");
    }

    // Get the claim with related data
    const { data: claim, error: claimError } = await supabaseClient
      .from("insurance_claims")
      .select(`
        *,
        policy:pet_insurance_policies(
          pet:pet_profiles(id, name, user_id),
          vet_insurance_providers(name)
        )
      `)
      .eq("id", claimId)
      .single();

    if (claimError || !claim) {
      throw new Error("Claim not found");
    }

    if (claim.vet_id !== vet.id) {
      throw new Error("You are not authorized to deny this claim");
    }

    logStep("Claim retrieved", { claimId, currentStatus: claim.status });

    // Update claim status to denied
    const { error: updateClaimError } = await supabaseClient
      .from("insurance_claims")
      .update({
        status: "denied",
        denial_reason: denialReason || "Claim denied by insurance carrier",
        processed_at: new Date().toISOString(),
      })
      .eq("id", claimId);

    if (updateClaimError) throw updateClaimError;

    logStep("Claim marked as denied");

    // Get or create invoice slice for this claim
    const gapAmount = Number(claim.total_amount) - Number(claim.covered_amount || 0);
    
    // Check if an invoice slice already exists
    let sliceId: string;
    const { data: existingSlice } = await supabaseClient
      .from("invoice_slices")
      .select("id")
      .eq("claim_id", claimId)
      .maybeSingle();

    if (existingSlice) {
      // Update existing slice to action_required
      const { error: updateSliceError } = await supabaseClient
        .from("invoice_slices")
        .update({
          recovery_status: "action_required",
          gap_amount: claim.total_amount, // Full amount since denied
          actual_amount: 0,
          notes: denialReason || "Claim denied - full balance due from owner",
        })
        .eq("id", existingSlice.id);

      if (updateSliceError) throw updateSliceError;
      sliceId = existingSlice.id;
      logStep("Existing slice updated to action_required", { sliceId });
    } else if (claim.invoice_id) {
      // Create new slice for denied claim
      const { data: newSlice, error: createSliceError } = await supabaseClient
        .from("invoice_slices")
        .insert({
          invoice_id: claim.invoice_id,
          claim_id: claimId,
          slice_type: "insurance",
          original_amount: claim.total_amount,
          actual_amount: 0,
          gap_amount: claim.total_amount,
          recovery_status: "action_required",
          notes: denialReason || "Claim denied - full balance due from owner",
        })
        .select("id")
        .single();

      if (createSliceError) throw createSliceError;
      sliceId = newSlice.id;
      logStep("New slice created with action_required", { sliceId });
    } else {
      throw new Error("No invoice associated with this claim");
    }

    // Get owner's user_id from the pet profile
    const ownerId = claim.policy?.pet?.user_id;
    if (!ownerId) {
      throw new Error("Could not find pet owner for this claim");
    }

    // Create notification for the owner
    const petName = claim.policy?.pet?.name || "your pet";
    const providerName = claim.policy?.vet_insurance_providers?.name || "Your insurance carrier";

    const { error: notifError } = await supabaseClient.from("notifications").insert({
      user_id: ownerId,
      title: "Insurance Claim Denied - Action Required",
      message: `${providerName} has denied the claim for ${petName}'s visit. A balance of $${Number(claim.total_amount).toFixed(2)} requires your attention.`,
      category: "transactional",
    });

    if (notifError) {
      logStep("Notification creation failed", { error: notifError.message });
    } else {
      logStep("Owner notification sent", { ownerId });
    }

    // Log the action
    await supabaseClient.from("claim_recovery_log").insert({
      slice_id: sliceId,
      action: "claim_denied",
      actor_type: "system",
      actor_id: user.id,
      details: {
        claim_id: claimId,
        denial_reason: denialReason,
        total_amount: claim.total_amount,
        owner_id: ownerId,
      },
    });

    logStep("Function completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        sliceId,
        ownerId,
        gapAmount: claim.total_amount,
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
