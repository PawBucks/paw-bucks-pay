import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify user
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { integration_id } = await req.json();

    // Get integration details
    const { data: integration, error: integrationError } = await supabase
      .from("vet_lab_integrations")
      .select("*")
      .eq("id", integration_id)
      .single();

    if (integrationError || !integration) {
      return new Response(
        JSON.stringify({ error: "Lab integration not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Fetching labs from ${integration.lab_vendor} for integration ${integration_id}`);

    // In production, this would call the actual lab vendor API
    // For now, we simulate the process
    
    let resultsImported = 0;
    let imagingImported = 0;
    let errorMessage = null;

    try {
      // Simulated API call based on vendor
      switch (integration.lab_vendor) {
        case "idexx":
          // Would call IDEXX VetConnect API
          console.log("Fetching from IDEXX VetConnect...");
          // const idexxResults = await fetchIDEXXResults(integration);
          break;
        
        case "antech":
          // Would call Antech API
          console.log("Fetching from Antech...");
          // const antechResults = await fetchAntechResults(integration);
          break;

        case "zoetis":
          // Would call Zoetis Reference Lab API
          console.log("Fetching from Zoetis...");
          break;

        default:
          console.log(`Vendor ${integration.lab_vendor} fetch not implemented`);
      }

      // Update last import timestamp
      await supabase
        .from("vet_lab_integrations")
        .update({ last_import_at: new Date().toISOString() })
        .eq("id", integration_id);

    } catch (fetchError) {
      errorMessage = fetchError instanceof Error ? fetchError.message : "Fetch failed";
      console.error("Lab fetch error:", errorMessage);
    }

    return new Response(
      JSON.stringify({
        success: !errorMessage,
        lab_vendor: integration.lab_vendor,
        results_imported: resultsImported,
        imaging_imported: imagingImported,
        error: errorMessage,
        message: "Lab fetch initiated - in production, this would pull real results from the lab API",
      }),
      { 
        status: errorMessage ? 500 : 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );

  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
