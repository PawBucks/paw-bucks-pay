import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[ACCOUNTANT-INVITATION] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
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

    const { invitationId, accountantEmail, accountantName, businessName, accessToken } = await req.json();

    logStep("Sending accountant invitation", { invitationId, accountantEmail, businessName });

    // Build portal URL
    const portalUrl = `https://paw-bucks-pay.lovable.app/accountant-portal/${accessToken}`;

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #7DD4D4; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 32px; font-weight: 800; color: #ffffff;">PAWBUCKS</h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 14px;">Tax Vault Access Invitation</p>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #1f2937; margin: 0 0 16px 0; font-size: 20px;">
                You've Been Invited to View Tax Records
              </h2>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi${accountantName ? ` ${accountantName}` : ''},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                <strong>${businessName}</strong> has invited you to access their PawBucks Tax Vault as their accountant. 
                You'll have secure, read-only access to view their business expenses, income summary, and mileage logs.
              </p>
              
              <!-- Access Info Box -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f0fdf4; border-radius: 8px; border: 1px solid #86efac; margin: 24px 0;">
                <tr>
                  <td style="padding: 20px;">
                    <p style="color: #166534; font-size: 14px; font-weight: 600; margin: 0 0 8px 0;">🔒 Secure Access Details</p>
                    <p style="color: #15803d; font-size: 14px; margin: 0;">
                      • View-only access to tax records<br>
                      • Add notes and suggestions<br>
                      • All actions are logged<br>
                      • Access expires in 30 days
                    </p>
                  </td>
                </tr>
              </table>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 16px 0;">
                    <a href="${portalUrl}" 
                       style="display: inline-block; background-color: #7DD4D4; color: #ffffff; font-weight: 600; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px;">
                      Access Tax Vault →
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0 0;">
                <strong>Security Note:</strong> This link is unique to you. Do not share it with others. 
                If you did not expect this invitation, please ignore this email.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} PawBucks. All rights reserved.<br>
                This email was sent because you were invited as an accountant.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

    const { error: emailError } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [accountantEmail],
      subject: `${businessName} has invited you to view their Tax Vault`,
      html: emailHtml,
    });

    if (emailError) {
      logStep("Failed to send email", { error: emailError.message });
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    logStep("Invitation email sent successfully");

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    logStep("Error sending invitation", { error: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
