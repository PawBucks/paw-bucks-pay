import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  recipientType: "all" | "merchants" | "pet_owners" | "individual";
  individualEmails?: string[];
  subject: string;
  htmlContent: string;
  textContent?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin role
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !userData.user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roleData, error: roleError } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "superadmin"])
      .single();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { recipientType, individualEmails, subject, htmlContent, textContent }: EmailRequest = await req.json();

    if (!subject || !htmlContent) {
      return new Response(
        JSON.stringify({ error: "Subject and content are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let emails: string[] = [];

    if (recipientType === "individual" && individualEmails && individualEmails.length > 0) {
      emails = individualEmails;
    } else if (recipientType === "all") {
      const { data: allProfiles } = await supabase
        .from("profiles")
        .select("email")
        .not("email", "is", null);
      emails = (allProfiles || []).map((p) => p.email).filter(Boolean);
    } else if (recipientType === "merchants") {
      const { data: merchantProfiles } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_type", "merchant")
        .not("email", "is", null);
      emails = (merchantProfiles || []).map((p) => p.email).filter(Boolean);
    } else if (recipientType === "pet_owners") {
      const { data: petOwnerProfiles } = await supabase
        .from("profiles")
        .select("email")
        .eq("user_type", "pet_owner")
        .not("email", "is", null);
      emails = (petOwnerProfiles || []).map((p) => p.email).filter(Boolean);
    }

    if (emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "No recipients found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Sending email to ${emails.length} recipients`);

    // Send emails in batches of 50 to avoid rate limits
    const batchSize = 50;
    const results: { success: number; failed: number; errors: string[] } = {
      success: 0,
      failed: 0,
      errors: [],
    };

    for (let i = 0; i < emails.length; i += batchSize) {
      const batch = emails.slice(i, i + batchSize);
      
      const promises = batch.map(async (email) => {
        try {
          const { error } = await resend.emails.send({
            from: "PawBucks <noreply@pawbucks.app>",
            to: [email],
            subject: subject,
            html: htmlContent,
            text: textContent || undefined,
          });

          if (error) {
            console.error(`Failed to send to ${email}:`, error);
            results.failed++;
            results.errors.push(`${email}: ${error.message}`);
          } else {
            results.success++;
          }
        } catch (err: any) {
          console.error(`Error sending to ${email}:`, err);
          results.failed++;
          results.errors.push(`${email}: ${err.message}`);
        }
      });

      await Promise.all(promises);
    }

    // Log the email action
    await supabase.from("audit_logs").insert({
      admin_id: userData.user.id,
      action: "send_email",
      entity_type: "email",
      entity_id: null,
      changes: {
        recipient_type: recipientType,
        recipient_count: emails.length,
        subject: subject,
        success_count: results.success,
        failed_count: results.failed,
      },
    });

    console.log(`Email sending complete: ${results.success} sent, ${results.failed} failed`);

    return new Response(
      JSON.stringify({
        success: true,
        sent: results.success,
        failed: results.failed,
        errors: results.errors.slice(0, 10), // Only return first 10 errors
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in admin-send-email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
