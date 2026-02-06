import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailHookPayload {
  user: {
    id: string;
    email: string;
    user_metadata?: {
      full_name?: string;
    };
  };
  email_data: {
    token: string;
    token_hash: string;
    redirect_to: string;
    email_action_type: string;
    site_url: string;
  };
}

const generatePasswordRecoveryEmail = (
  userName: string,
  confirmationUrl: string
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
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #7DD4D4; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(125, 212, 212, 0.3), 0 0 30px rgba(125, 212, 212, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
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
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #7DD4D4 0%, #5FCBC9 100%); color: #1a3a3a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(125, 212, 212, 0.4);">
                      Reset Password
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                This link will expire in 24 hours. If you didn't request a password reset, you can safely ignore this email.
              </p>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #5FCBC9; font-size: 12px; word-break: break-all; margin: 8px 0 0 0;">
                ${confirmationUrl}
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

const generateSignupConfirmationEmail = (
  userName: string,
  confirmationUrl: string
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Confirm Your Email</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #7DD4D4; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(125, 212, 212, 0.3), 0 0 30px rgba(125, 212, 212, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Welcome to PawBucks!</h2>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi${userName ? ` ${userName}` : ''},
              </p>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                Thanks for signing up! Please confirm your email address by clicking the button below:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px 0;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #7DD4D4 0%, #5FCBC9 100%); color: #1a3a3a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(125, 212, 212, 0.4);">
                      Confirm Email
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #5FCBC9; font-size: 12px; word-break: break-all; margin: 8px 0 0 0;">
                ${confirmationUrl}
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

const generateMagicLinkEmail = (
  userName: string,
  confirmationUrl: string
): string => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Your Magic Link</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" max-width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1); max-width: 600px;">
          <!-- Header -->
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #7DD4D4; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(125, 212, 212, 0.3), 0 0 30px rgba(125, 212, 212, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px 32px;">
              <h2 style="color: #1a1a1a; margin: 0 0 16px 0; font-size: 24px; font-weight: 600;">Login to PawBucks</h2>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 24px 0;">
                Hi${userName ? ` ${userName}` : ''},
              </p>
              
              <p style="color: #4a4a4a; font-size: 16px; line-height: 1.6; margin: 0 0 32px 0;">
                Click the button below to securely log in to your account:
              </p>
              
              <!-- CTA Button -->
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center" style="padding: 0 0 32px 0;">
                    <a href="${confirmationUrl}" 
                       style="display: inline-block; background: linear-gradient(135deg, #7DD4D4 0%, #5FCBC9 100%); color: #1a3a3a; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(125, 212, 212, 0.4);">
                      Log In
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0 0 16px 0;">
                This link will expire in 1 hour. If you didn't request this, you can safely ignore this email.
              </p>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 0;">
                If the button above doesn't work, copy and paste this link into your browser:
              </p>
              <p style="color: #5FCBC9; font-size: 12px; word-break: break-all; margin: 8px 0 0 0;">
                ${confirmationUrl}
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
    const payload: EmailHookPayload = await req.json();
    
    console.log("Email hook received:", JSON.stringify({
      email: payload.user?.email,
      action_type: payload.email_data?.email_action_type,
      redirect_to: payload.email_data?.redirect_to,
      site_url: payload.email_data?.site_url,
    }));

    const { user, email_data } = payload;
    
    if (!user?.email || !email_data) {
      console.error("Missing required payload data");
      return new Response(
        JSON.stringify({ error: "Missing required payload data" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    const { token_hash, redirect_to, email_action_type, site_url } = email_data;
    const userName = user.user_metadata?.full_name || "";
    
    // Build the confirmation URL
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || site_url;
    const confirmationUrl = `${supabaseUrl}/auth/v1/verify?token=${token_hash}&type=${email_action_type}&redirect_to=${encodeURIComponent(redirect_to)}`;
    
    console.log("Generated confirmation URL:", confirmationUrl);

    let subject: string;
    let html: string;

    switch (email_action_type) {
      case "recovery":
        subject = "🔑 Reset Your PawBucks Password";
        html = generatePasswordRecoveryEmail(userName, confirmationUrl);
        break;
      case "signup":
      case "email_confirmation":
        subject = "🎉 Welcome to PawBucks - Confirm Your Email";
        html = generateSignupConfirmationEmail(userName, confirmationUrl);
        break;
      case "magiclink":
        subject = "🔐 Your PawBucks Login Link";
        html = generateMagicLinkEmail(userName, confirmationUrl);
        break;
      case "invite":
        subject = "🎊 You've Been Invited to PawBucks";
        html = generateSignupConfirmationEmail(userName, confirmationUrl);
        break;
      default:
        subject = "PawBucks Notification";
        html = generateMagicLinkEmail(userName, confirmationUrl);
    }

    console.log(`Sending ${email_action_type} email to ${user.email}`);

    const emailResponse = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [user.email],
      subject,
      html,
    });

    console.log("Email sent successfully:", JSON.stringify(emailResponse));

    return new Response(
      JSON.stringify({ success: true, message: "Email sent successfully" }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    console.error("Error in email-hook:", error);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
