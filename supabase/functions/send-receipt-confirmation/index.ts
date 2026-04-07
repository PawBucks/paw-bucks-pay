import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";

interface ReceiptConfirmationRequest {
  merchantName: string;
  purchaseAmount: number;
  receiptDate: string;
  estimatedPawBucks: number;
  pbPerDollar: number;
  tierLabel: string;
  submissionType: "partner" | "non_partner";
  vestingDays?: number;
}

function buildReceiptConfirmationHtml(data: ReceiptConfirmationRequest): string {
  const isNonPartner = data.submissionType === "non_partner";
  const vestingNote = isNonPartner
    ? `<tr><td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Vesting Period</td><td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${data.vestingDays || 30} days</td></tr>`
    : "";

  const pawBucksExpectation = isNonPartner
    ? `Your PawBucks will be credited after admin review (24-72 hours) and will vest after ${data.vestingDays || 30} days.`
    : `Your PawBucks will be credited after admin review, typically within 24-72 hours.`;

  const typeLabel = isNonPartner ? "Other Pet Store" : "Partner";
  const primaryColor = "#2a9d8f"; // matches --primary: 178 55% 42%

  return `<!DOCTYPE html>
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
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <img src="${LOGO_URL}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 0 32px 40px 32px;">
              <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1f2937; text-align: center;">Receipt Submitted!</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.5;">
                Your ${typeLabel} receipt has been received and is now under review.
              </p>

              <!-- Summary Card -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Merchant</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${escapeHtml(data.merchantName)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Purchase Amount</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">$${data.purchaseAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Receipt Date</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${escapeHtml(data.receiptDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Earn Rate</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${data.pbPerDollar} PB/$1 (${escapeHtml(data.tierLabel)})</td>
                </tr>
                ${vestingNote}
                <tr>
                  <td style="padding: 16px; font-size: 16px; font-weight: 700; color: ${primaryColor};">Expected PawBucks</td>
                  <td style="padding: 16px; font-size: 20px; font-weight: 700; color: ${primaryColor}; text-align: right;">~${data.estimatedPawBucks.toLocaleString()} PB</td>
                </tr>
              </table>

              <!-- Timeline -->
              <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: ${primaryColor};">⏰ What happens next?</p>
                <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
                  ${pawBucksExpectation}
                </p>
              </div>

              <p style="margin: 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                If you have questions about this submission, please contact our support team.
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
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user auth
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

    const body: ReceiptConfirmationRequest = await req.json();

    if (!body.merchantName || !body.purchaseAmount || !body.receiptDate || !body.estimatedPawBucks) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get user email from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("email, full_name")
      .eq("id", userData.user.id)
      .single();

    const recipientEmail = profile?.email || userData.user.email;
    if (!recipientEmail) {
      return new Response(
        JSON.stringify({ error: "No email address found" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const html = buildReceiptConfirmationHtml(body);

    const { error: sendError } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [recipientEmail],
      subject: `Receipt Confirmed — ~${body.estimatedPawBucks.toLocaleString()} PawBucks from ${body.merchantName}`,
      html,
    });

    if (sendError) {
      console.error("Failed to send receipt confirmation:", sendError);
      return new Response(
        JSON.stringify({ error: sendError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Receipt confirmation sent to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-receipt-confirmation:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
