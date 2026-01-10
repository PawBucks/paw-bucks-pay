import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PasswordResetRequest {
  email: string;
  redirectUrl: string;
}

const generatePasswordResetEmail = (
  userName: string,
  resetLink: string
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Reset Your Password</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #22d3ee; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(34, 211, 238, 0.3), 0 0 30px rgba(34, 211, 238, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Reset Your Password</h2>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi${userName ? ` ${userName}` : ''},
              </p>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                You recently requested to reset your password for your PawBucks account. Click the button below to reset it:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px 0;">
                    <a href="${resetLink}" 
                       style="display: inline-block; background: linear-gradient(135deg, #8B5CF6 0%, #A855F7 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(139, 92, 246, 0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                This link will expire in 1 hour. If you didn't request a password reset, you can safely ignore this email.
              </p>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #8B5CF6; font-size: 12px; word-break: break-all; margin: 8px 0 0 0;">
                ${resetLink}
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                © ${new Date().getFullYear()} PawBucks. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { email, redirectUrl }: PasswordResetRequest = await req.json();
    
    if (!email) {
      return new Response(
        JSON.stringify({ error: "Email is required" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log("Password reset requested for:", email);

    // Create admin client to generate recovery link
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    // Generate a password recovery link using the Admin API
    const { data, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "recovery",
      email: email,
      options: {
        redirectTo: redirectUrl,
      },
    });

    if (linkError) {
      console.error("Error generating recovery link:", linkError);
      // Don't reveal if the email exists or not for security
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    if (!data?.properties?.action_link) {
      console.error("No action link generated");
      return new Response(
        JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Get user name if available
    const userName = data.user?.user_metadata?.full_name || "";
    const resetLink = data.properties.action_link;

    console.log("Generated reset link for:", email);

    // Send the email via Resend
    // IMPORTANT: The 'from' address must use a verified domain in Resend
    // Using onboarding@resend.dev only works for emails to the Resend account owner
    const emailResponse = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [email],
      subject: "🔑 Reset Your PawBucks Password",
      html: generatePasswordResetEmail(userName, resetLink),
    });

    console.log("Email sent successfully:", JSON.stringify(emailResponse));

    return new Response(
      JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in send-password-reset:", error);
    
    // Always return success to prevent email enumeration
    return new Response(
      JSON.stringify({ success: true, message: "If an account exists, a reset email has been sent." }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
