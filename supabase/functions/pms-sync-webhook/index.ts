import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-pms-signature, x-pms-vendor",
};

/**
 * Verify HMAC-SHA256 signature from PMS vendor
 */
async function verifyPmsSignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  try {
    if (!signature || !secret) {
      return false;
    }

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"]
    );

    // Handle hex-encoded signature
    const signatureBytes = new Uint8Array(
      signature.match(/.{1,2}/g)?.map((byte) => parseInt(byte, 16)) || []
    );

    return await crypto.subtle.verify(
      "HMAC",
      key,
      signatureBytes,
      encoder.encode(payload)
    );
  } catch (error) {
    console.error("Signature verification error:", error);
    return false;
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get headers for authentication
    const pmsVendor = req.headers.get("x-pms-vendor");
    const pmsSignature = req.headers.get("x-pms-signature");

    // Validate required headers
    if (!pmsSignature) {
      console.error("Missing x-pms-signature header");
      return new Response(
        JSON.stringify({ error: "Missing signature header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Read request body as text for signature verification
    const rawBody = await req.text();
    
    if (!rawBody) {
      console.error("Empty request body");
      return new Response(
        JSON.stringify({ error: "Empty request body" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the payload
    let payload;
    try {
      payload = JSON.parse(rawBody);
    } catch (e) {
      console.error("Invalid JSON payload:", e);
      return new Response(
        JSON.stringify({ error: "Invalid JSON payload" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { event_type, practice_id, data } = payload;

    if (!practice_id) {
      console.error("Missing practice_id in payload");
      return new Response(
        JSON.stringify({ error: "Missing practice_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`PMS webhook received: ${event_type} from ${pmsVendor} for practice ${practice_id}`);

    // Find the integration by practice_id and get webhook secret
    const { data: integration, error: integrationError } = await supabase
      .from("vet_pms_integrations")
      .select("*, webhook_secret")
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

    // Verify webhook signature
    if (!integration.webhook_secret) {
      console.error("Webhook secret not configured for integration:", integration.id);
      return new Response(
        JSON.stringify({ error: "Webhook not configured - please set webhook secret" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const isValidSignature = await verifyPmsSignature(
      rawBody,
      pmsSignature,
      integration.webhook_secret
    );

    if (!isValidSignature) {
      console.error("Invalid webhook signature for practice:", practice_id);
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Webhook signature verified successfully");

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
          recordsProcessed = 1;
          recordsCreated = 1;
          console.log("Processing vaccination event", data);
          break;

        case "labresult.added":
          // Handle lab result from PMS
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
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
