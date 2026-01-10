import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[SEND-SHARE-INVITATION] ${step}`, details ? JSON.stringify(details) : "");
};

// Generate a secure invite token
function generateInviteToken(): string {
  const array = new Uint8Array(24);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Use service role to update invite token
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    const supabaseAnon = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);

    // Authenticate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseAnon.auth.getUser(token);
    if (userError) throw new Error(`Auth error: ${userError.message}`);

    const user = userData.user;
    if (!user) throw new Error("User not authenticated");

    logStep("User authenticated", { userId: user.id });

    // Parse request body
    const { inviteeEmail, inviterName, inviterEmail } = await req.json();

    if (!inviteeEmail) {
      throw new Error("Invitee email is required");
    }

    // Generate invite token and update the invitation record
    const inviteToken = generateInviteToken();
    
    const { error: updateError } = await supabaseAdmin
      .from("shared_account_members")
      .update({ invite_token: inviteToken })
      .eq("owner_id", user.id)
      .eq("member_email", inviteeEmail.toLowerCase())
      .eq("status", "pending");

    if (updateError) {
      logStep("Failed to update invite token", { error: updateError });
      // Don't fail - continue with invitation without token
    } else {
      logStep("Invite token saved", { inviteToken: inviteToken.substring(0, 8) + "..." });
    }

    logStep("Sending invitation email", { inviteeEmail, inviterName });

    const resend = new Resend(resendApiKey);

    const senderName = inviterName || inviterEmail || "A PawBucks member";
    const appUrl = "https://pawbucks.app";
    const signupUrl = `${appUrl}/auth?invite=${inviteToken}`;

    const { data: emailData, error: emailError } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [inviteeEmail],
      subject: `${senderName} invited you to share PawBucks!`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
          <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background-color: #ffffff; padding: 32px; text-align: center;">
                <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #22d3ee; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(34, 211, 238, 0.3), 0 0 30px rgba(34, 211, 238, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
                <p style="margin: 16px 0 0 0; color: #f59e0b; font-size: 16px; font-weight: 600;">🐾 You're Invited!</p>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px;">
                <p style="font-size: 16px; color: #333; margin: 0 0 24px 0;">
                  <strong>${senderName}</strong> wants to share their PawBucks account with you!
                </p>
                
                <div style="background: #fef3c7; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
                  <p style="margin: 0; color: #92400e; font-size: 15px; line-height: 1.6;">
                    By accepting this invitation, you'll share ${senderName}'s PawBucks wallet and enjoy rewards together as part of their account family.
                  </p>
                </div>
                
                <p style="font-size: 14px; color: #666; margin: 0 0 24px 0;">
                  Click the button below to create your account and automatically join their shared account:
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center; margin-top: 32px;">
                  <a href="${signupUrl}" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    Accept Invitation & Join
                  </a>
                </div>
                
                <p style="font-size: 12px; color: #999; margin: 24px 0 0 0; text-align: center;">
                  Already have a PawBucks account? <a href="${appUrl}/auth?invite=${inviteToken}" style="color: #f59e0b;">Sign in here</a> to accept the invitation.
                </p>
              </div>
              
              <!-- Footer -->
              <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; color: #999; font-size: 12px;">
                  If you didn't expect this invitation, you can safely ignore this email.
                </p>
                <p style="margin: 0; color: #999; font-size: 12px;">
                  © ${new Date().getFullYear()} PawBucks. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailError) {
      logStep("Email send failed", { error: emailError });
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    logStep("Email sent successfully", { emailId: emailData?.id });

    return new Response(
      JSON.stringify({ success: true, emailId: emailData?.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
