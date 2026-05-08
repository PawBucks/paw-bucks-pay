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
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const { redemption_code } = await req.json();

    if (!redemption_code || typeof redemption_code !== 'string') {
      return new Response(
        JSON.stringify({ error: "Valid redemption code is required" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    // Validate redemption code format (PBK-XXXXXXXX)
    if (!/^PBK-[A-Z0-9]{8}$/.test(redemption_code)) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          message: "Invalid redemption code format"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Create service role client for database operations
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Find redemption activity
    const { data: activity, error: activityError } = await serviceClient
      .from("pawbucks_activity")
      .select("*")
      .eq("redemption_code", redemption_code)
      .eq("type", "redeem")
      .maybeSingle();

    if (activityError || !activity) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          message: "Invalid redemption code"
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Hydrate profile + offer in parallel.
    const [{ data: profile }, { data: offer }] = await Promise.all([
      serviceClient.from("profiles").select("full_name, email").eq("id", activity.user_id).maybeSingle(),
      activity.offer_id
        ? serviceClient.from("partner_offers").select("title, description").eq("id", activity.offer_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    // Check if already used
    if (activity.redemption_used) {
      return new Response(
        JSON.stringify({ 
          valid: false,
          message: "This code has already been used",
          used_at: activity.updated_at
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    // Verify the authenticated user is the partner who owns this redemption
    const { data: partnerCheck } = await supabaseClient
      .from("merchants")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (!partnerCheck) {
      return new Response(
        JSON.stringify({ error: "Only merchants can verify redemptions" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 403,
        }
      );
    }

    // Mark as used
    const { error: updateError } = await serviceClient
      .from("pawbucks_activity")
      .update({ redemption_used: true })
      .eq("id", activity.id);

    if (updateError) {
      throw new Error("Failed to mark redemption as used");
    }

    console.log(`Redemption code ${redemption_code} verified and marked as used`);

    return new Response(
      JSON.stringify({
        valid: true,
        user_name: profile?.full_name || "Customer",
        user_email: profile?.email,
        offer_title: offer?.title || activity.description,
        coins_spent: Math.abs(activity.amount),
        redeemed_at: activity.created_at,
        message: "Redemption verified successfully"
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error("Verification error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
