import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email } = await req.json();

    if (!email) {
      console.error("Missing email in request");
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Processing password reset request for: ${email}`);

    // Create Supabase client with service role for admin operations
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );

    // Check if this email belongs to an admin user
    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("id")
      .eq("email", email)
      .single();

    if (profileError || !profile) {
      console.log("Profile not found for email:", email);
      // Return success to prevent email enumeration attacks
      return new Response(
        JSON.stringify({ success: true, message: "If an admin account exists with this email, a password reset link has been sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check if user has admin role
    const { data: hasAdminRole, error: roleError } = await supabaseAdmin.rpc("has_role", {
      _user_id: profile.id,
      _role: "admin",
    });

    if (roleError) {
      console.error("Error checking admin role:", roleError);
      return new Response(
        JSON.stringify({ error: "Failed to verify admin status" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!hasAdminRole) {
      console.log("User is not an admin:", email);
      // Return success to prevent role enumeration attacks
      return new Response(
        JSON.stringify({ success: true, message: "If an admin account exists with this email, a password reset link has been sent." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Send password reset email via Supabase Auth.
    // SECURITY: The redirect URL must NEVER come from caller-controlled
    // headers (e.g. Origin) — that would let an attacker phish the reset
    // token. Always use a server-side configured base URL.
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://pawbucks.app";
    const { error: resetError } = await supabaseAdmin.auth.resetPasswordForEmail(email, {
      redirectTo: `${APP_BASE_URL}/admin/reset-password`,
    });

    if (resetError) {
      console.error("Error sending reset email:", resetError);
      return new Response(
        JSON.stringify({ error: "Failed to send reset email" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log("Password reset email sent successfully for:", email);

    return new Response(
      JSON.stringify({ success: true, message: "Password reset email sent successfully" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in admin-reset-password:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
