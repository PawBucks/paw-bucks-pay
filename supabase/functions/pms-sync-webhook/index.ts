import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pms-signature, x-pms-vendor",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const pmsVendor = req.headers.get("x-pms-vendor");
    const pmsSignature = req.headers.get("x-pms-signature");
    
    // In production, verify the webhook signature based on vendor
    // This is a simplified implementation
    
    const payload = await req.json();
    const { event_type, practice_id, data } = payload;

    console.log(`PMS webhook received: ${event_type} from ${pmsVendor} for practice ${practice_id}`);

    // Find the integration by practice_id
    const { data: integration, error: integrationError } = await supabase
      .from("vet_pms_integrations")
      .select("*")
      .eq("practice_id", practice_id)
      .eq("is_active", true)
      .single();

    if (integrationError || !integration) {
      console.error("Integration not found for practice:", practice_id);
      return new Response(
        JSON.stringify({ error: "Integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from("pms_sync_logs")
      .insert({
        integration_id: integration.id,
        sync_type: "webhook",
        direction: "inbound",
        status: "in_progress",
      })
      .select()
      .single();

    if (syncLogError) {
      console.error("Failed to create sync log:", syncLogError);
    }

    let recordsProcessed = 0;
    let recordsCreated = 0;
    let recordsUpdated = 0;
    let errorMessage = null;

    try {
      switch (event_type) {
        case "patient.updated":
        case "patient.created":
          // Handle patient/pet profile updates
          // In production, this would map PMS patient data to pet_profiles
          recordsProcessed = 1;
          if (event_type === "patient.created") {
            recordsCreated = 1;
          } else {
            recordsUpdated = 1;
          }
          console.log(`Processing patient event: ${event_type}`, data);
          break;

        case "vaccination.added":
          // Handle vaccination record sync
          // Would create entry in pet_vaccinations
          recordsProcessed = 1;
          recordsCreated = 1;
          console.log("Processing vaccination event", data);
          break;

        case "labresult.added":
          // Handle lab result from PMS
          // Would create entry in pet_lab_results
          recordsProcessed = 1;
          recordsCreated = 1;
          console.log("Processing lab result event", data);
          break;

        case "appointment.scheduled":
        case "appointment.completed":
          // Handle appointment events
          recordsProcessed = 1;
          recordsUpdated = 1;
          console.log(`Processing appointment event: ${event_type}`, data);
          break;

        default:
          console.log(`Unhandled event type: ${event_type}`);
      }

      // Update sync log with success
      if (syncLog) {
        await supabase
          .from("pms_sync_logs")
          .update({
            status: "completed",
            records_processed: recordsProcessed,
            records_created: recordsCreated,
            records_updated: recordsUpdated,
            completed_at: new Date().toISOString(),
            details: { event_type, data_summary: data ? Object.keys(data) : [] },
          })
          .eq("id", syncLog.id);
      }

      // Update integration last_sync_at
      await supabase
        .from("vet_pms_integrations")
        .update({ last_sync_at: new Date().toISOString() })
        .eq("id", integration.id);

    } catch (processingError) {
      errorMessage = processingError instanceof Error ? processingError.message : "Processing failed";
      console.error("Processing error:", errorMessage);

      if (syncLog) {
        await supabase
          .from("pms_sync_logs")
          .update({
            status: "failed",
            error_message: errorMessage,
            completed_at: new Date().toISOString(),
          })
          .eq("id", syncLog.id);
      }
    }

    return new Response(
      JSON.stringify({
        success: !errorMessage,
        records_processed: recordsProcessed,
        records_created: recordsCreated,
        records_updated: recordsUpdated,
        error: errorMessage,
      }),
      { 
        status: errorMessage ? 500 : 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
