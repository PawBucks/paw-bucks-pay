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
    console.log("Starting merchant service expiration check...");

    // Create service role client for database operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const now = new Date().toISOString();

    // Find all active services that have expired
    const { data: expiredServices, error: fetchError } = await supabaseAdmin
      .from("merchant_service_purchases")
      .select(`
        id, 
        merchant_id, 
        service_id, 
        status, 
        expires_at,
        service:merchant_market_services(name),
        merchant:merchants(business_name, user_id)
      `)
      .eq("status", "active")
      .not("expires_at", "is", null)
      .lte("expires_at", now);

    if (fetchError) {
      console.error("Error fetching expired services:", fetchError);
      throw fetchError;
    }

    if (!expiredServices || expiredServices.length === 0) {
      console.log("No expired merchant services found");
      return new Response(
        JSON.stringify({ 
          success: true, 
          expired: 0, 
          message: "No merchant services to expire" 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${expiredServices.length} expired services to update`);

    let expiredCount = 0;
    const errors: string[] = [];

    // Process each expired service
    for (const service of expiredServices) {
      try {
        // Update status to expired
        const { error: updateError } = await supabaseAdmin
          .from("merchant_service_purchases")
          .update({ 
            status: "expired",
            updated_at: now 
          })
          .eq("id", service.id);

        if (updateError) {
          console.error(`Error expiring service ${service.id}:`, updateError);
          errors.push(`Service ${service.id}: ${updateError.message}`);
          continue;
        }

        // Get merchant and service details for notification
        const serviceName = (service.service as any)?.name || "Service";
        const merchantUserId = (service.merchant as any)?.user_id;
        const merchantName = (service.merchant as any)?.business_name || "Merchant";

        // Send notification to merchant if we have their user_id
        if (merchantUserId) {
          await supabaseAdmin.from("notifications").insert({
            user_id: merchantUserId,
            title: "Service Expired",
            message: `Your "${serviceName}" service has expired. Visit the Merchant Market to renew and continue enjoying its benefits.`,
            category: "transactional",
          });
        }

        // Log the expiration action for audit purposes
        try {
          await supabaseAdmin.rpc('log_admin_action', {
            _action: 'AUTO_EXPIRE_MERCHANT_SERVICE',
            _entity_type: 'merchant_service_purchase',
            _entity_id: service.id,
            _changes: {
              service_name: serviceName,
              merchant_name: merchantName,
              merchant_id: service.merchant_id,
              expired_at: now,
              previous_expires_at: service.expires_at,
            },
          });
        } catch (logErr) {
          // Log error but don't fail the operation
          console.error(`Failed to log admin action for service ${service.id}:`, logErr);
        }

        expiredCount++;
        console.log(`Expired service "${serviceName}" for "${merchantName}"`);
      } catch (error) {
        console.error(`Error processing service ${service.id}:`, error);
        errors.push(`Service ${service.id}: ${error instanceof Error ? error.message : "Unknown error"}`);
      }
    }

    console.log(`Expiration complete. Expired: ${expiredCount}, Errors: ${errors.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        expired: expiredCount,
        total_found: expiredServices.length,
        errors: errors.length > 0 ? errors : undefined,
        message: `Successfully expired ${expiredCount} merchant services`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Service expiration scheduler error:", error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : "An unexpected error occurred" 
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
