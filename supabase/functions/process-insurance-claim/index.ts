import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[INSURANCE-CLAIM] ${step}${detailsStr}`);
};

// Calculate insurance coverage based on policy details
function calculateCoverage(
  totalAmount: number,
  policy: {
    copay_percentage: number;
    deductible_amount: number;
    deductible_met: number;
    annual_limit: number | null;
    annual_used: number;
  }
) {
  const copayPercentage = policy.copay_percentage || 20;
  const deductibleRemaining = Math.max(0, (policy.deductible_amount || 0) - (policy.deductible_met || 0));
  const annualRemaining = policy.annual_limit 
    ? Math.max(0, policy.annual_limit - (policy.annual_used || 0))
    : Infinity;

  // Apply deductible first
  const afterDeductible = Math.max(0, totalAmount - deductibleRemaining);
  const deductibleApplied = Math.min(deductibleRemaining, totalAmount);

  // Calculate insurance portion (after copay)
  const insurancePortion = afterDeductible * (1 - copayPercentage / 100);
  
  // Apply annual limit
  const coveredAmount = Math.min(insurancePortion, annualRemaining);
  
  // Calculate owner responsibility
  const copayAmount = afterDeductible * (copayPercentage / 100);
  const ownerResponsibility = deductibleApplied + copayAmount + Math.max(0, insurancePortion - annualRemaining);

  return {
    coveredAmount: Math.round(coveredAmount * 100) / 100,
    copayAmount: Math.round(copayAmount * 100) / 100,
    deductibleApplied: Math.round(deductibleApplied * 100) / 100,
    ownerResponsibility: Math.round(ownerResponsibility * 100) / 100,
  };
}

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

    // Authenticate user (vet)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    // Verify user is a vet
    const { data: vet, error: vetError } = await supabaseClient
      .from("partner_vets")
      .select("id, name, contact_email")
      .eq("user_id", user.id)
      .single();

    if (vetError || !vet) throw new Error("You must be a registered vet to process claims");
    logStep("Vet verified", { vetId: vet.id, vetName: vet.name });

    const { 
      invoiceId, 
      policyId, 
      serviceDate, 
      diagnosisCodes = [], 
      procedureCodes = [],
      notes,
      autoSubmit = false 
    } = await req.json();

    if (!invoiceId || !policyId) {
      throw new Error("Invoice ID and Policy ID are required");
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from("invoices")
      .select("*, invoice_items(*)")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) throw new Error("Invoice not found");
    logStep("Invoice retrieved", { invoiceId, total: invoice.total });

    // Get policy details
    const { data: policy, error: policyError } = await supabaseClient
      .from("pet_insurance_policies")
      .select("*, vet_insurance_providers(name, code, claim_submission_email)")
      .eq("id", policyId)
      .single();

    if (policyError || !policy) throw new Error("Insurance policy not found");
    if (!policy.is_active) throw new Error("Insurance policy is not active");
    logStep("Policy retrieved", { 
      policyNumber: policy.policy_number, 
      provider: policy.vet_insurance_providers?.name 
    });

    // Calculate coverage
    const totalAmount = Number(invoice.total);
    const coverage = calculateCoverage(totalAmount, {
      copay_percentage: policy.copay_percentage,
      deductible_amount: policy.deductible_amount,
      deductible_met: policy.deductible_met,
      annual_limit: policy.annual_limit,
      annual_used: policy.annual_used,
    });

    logStep("Coverage calculated", coverage);

    // Build claim data for submission
    const claimData = {
      provider_code: policy.vet_insurance_providers?.code,
      policy_number: policy.policy_number,
      member_id: policy.member_id,
      group_number: policy.group_number,
      patient_info: {
        pet_id: policy.pet_id,
      },
      service_details: {
        service_date: serviceDate || new Date().toISOString().split("T")[0],
        diagnosis_codes: diagnosisCodes,
        procedure_codes: procedureCodes,
        line_items: invoice.invoice_items?.map((item: any) => ({
          description: item.description,
          quantity: item.quantity,
          unit_price: item.unit_price,
          total: item.total,
        })) || [],
      },
      amounts: {
        total_charged: totalAmount,
        ...coverage,
      },
      vet_info: {
        vet_id: vet.id,
        vet_name: vet.name,
        vet_email: vet.contact_email,
      },
    };

    // Create insurance claim record
    const { data: claim, error: claimError } = await supabaseClient
      .from("insurance_claims")
      .insert({
        policy_id: policyId,
        invoice_id: invoiceId,
        vet_id: vet.id,
        service_date: serviceDate || new Date().toISOString().split("T")[0],
        diagnosis_codes: diagnosisCodes,
        procedure_codes: procedureCodes,
        total_amount: totalAmount,
        covered_amount: coverage.coveredAmount,
        copay_amount: coverage.copayAmount,
        deductible_applied: coverage.deductibleApplied,
        owner_responsibility: coverage.ownerResponsibility,
        status: autoSubmit ? "pending_submission" : "draft",
        notes,
        claim_data: claimData,
      })
      .select()
      .single();

    if (claimError) throw new Error(`Failed to create claim: ${claimError.message}`);
    logStep("Claim created", { claimId: claim.id, claimNumber: claim.claim_number });

    // Update policy deductible met amount
    if (coverage.deductibleApplied > 0) {
      await supabaseClient
        .from("pet_insurance_policies")
        .update({ 
          deductible_met: (policy.deductible_met || 0) + coverage.deductibleApplied,
          annual_used: (policy.annual_used || 0) + coverage.coveredAmount,
        })
        .eq("id", policyId);
      logStep("Policy updated with deductible and annual usage");
    }

    // If auto-submit, send to insurance provider
    let submissionResult = null;
    if (autoSubmit && policy.vet_insurance_providers?.claim_submission_email) {
      // In a real implementation, this would integrate with insurance APIs
      // For now, we'll simulate submission via email notification
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        try {
          const emailResponse = await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${resendApiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: "PawBucks Claims <claims@pawbucks.app>",
              to: [policy.vet_insurance_providers.claim_submission_email],
              subject: `Insurance Claim Submission - ${claim.claim_number}`,
              html: `
                <h2>Insurance Claim Submission</h2>
                <p><strong>Claim Number:</strong> ${claim.claim_number}</p>
                <p><strong>Policy Number:</strong> ${policy.policy_number}</p>
                <p><strong>Provider:</strong> ${policy.vet_insurance_providers.name}</p>
                <p><strong>Service Date:</strong> ${claim.service_date}</p>
                <hr>
                <h3>Amounts</h3>
                <ul>
                  <li>Total Charged: $${totalAmount.toFixed(2)}</li>
                  <li>Covered Amount: $${coverage.coveredAmount.toFixed(2)}</li>
                  <li>Copay: $${coverage.copayAmount.toFixed(2)}</li>
                  <li>Deductible Applied: $${coverage.deductibleApplied.toFixed(2)}</li>
                  <li>Owner Responsibility: $${coverage.ownerResponsibility.toFixed(2)}</li>
                </ul>
                <hr>
                <p>Please process this claim at your earliest convenience.</p>
              `,
            }),
          });

          if (emailResponse.ok) {
            await supabaseClient
              .from("insurance_claims")
              .update({ 
                status: "submitted", 
                submitted_at: new Date().toISOString(),
                submission_method: "email",
              })
              .eq("id", claim.id);
            
            submissionResult = { success: true, method: "email" };
            logStep("Claim submitted via email");
          }
        } catch (emailError) {
          logStep("Email submission failed", { error: String(emailError) });
          submissionResult = { success: false, error: "Email submission failed" };
        }
      }
    }

    // Create invoice slice for tracking claim recovery
    const { data: slice, error: sliceError } = await supabaseClient
      .from("invoice_slices")
      .insert({
        invoice_id: invoiceId,
        claim_id: claim.id,
        slice_type: "insurance",
        original_amount: totalAmount,
        carrier_estimate: coverage.coveredAmount,
        gap_amount: 0, // Will be updated when carrier pays
        recovery_status: "pending",
      })
      .select()
      .single();

    if (sliceError) {
      logStep("Warning: Failed to create invoice slice", { error: sliceError.message });
    } else {
      logStep("Invoice slice created", { sliceId: slice?.id });
    }

    // Create locked rewards for the pet owner (pending state)
    // Get pet owner's user_id from the policy
    const { data: petData } = await supabaseClient
      .from("pet_profiles")
      .select("user_id")
      .eq("id", policy.pet_id)
      .single();

    if (petData?.user_id && slice) {
      // Get owner's subscription tier to calculate rewards
      const { data: subData } = await supabaseClient
        .from("user_subscriptions")
        .select("tier")
        .eq("user_id", petData.user_id)
        .eq("status", "active")
        .maybeSingle();

      const tier = subData?.tier || "free";
      const multiplier = tier === "pawpass_plus" ? 30 : tier === "pawpass" ? 20 : 10;
      const lockedRewards = Math.floor(totalAmount * multiplier);

      if (lockedRewards > 0) {
        // Create locked reward entry (pending status, linked to slice)
        await supabaseClient.from("pawbucks_activity").insert({
          user_id: petData.user_id,
          type: "credit",
          amount: lockedRewards,
          description: `Rewards for vet visit (${claim.claim_number}) - Pending insurance`,
          source: "insurance_claim",
          pawbucks_status: "pending",
          slice_id: slice.id,
        });

        logStep("Locked rewards created", { 
          ownerId: petData.user_id, 
          lockedRewards, 
          multiplier,
          sliceId: slice.id 
        });
      }
    }

    // Return claim details with payment split information
    const response = {
      success: true,
      claim: {
        id: claim.id,
        claimNumber: claim.claim_number,
        status: claim.status,
      },
      paymentSplit: {
        totalInvoice: totalAmount,
        insurancePortion: coverage.coveredAmount,
        ownerCopay: coverage.ownerResponsibility,
        deductibleApplied: coverage.deductibleApplied,
      },
      provider: {
        name: policy.vet_insurance_providers?.name,
        code: policy.vet_insurance_providers?.code,
      },
      submission: submissionResult,
      slice: slice ? { id: slice.id } : null,
      lockedRewards: petData?.user_id ? true : false,
    };

    logStep("Claim processing complete", response);

    return new Response(JSON.stringify(response), {
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
