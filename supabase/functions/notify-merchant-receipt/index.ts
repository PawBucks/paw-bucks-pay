import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOGO_URL = "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";
const APP_URL = "https://pawbucks.app";

interface MerchantReceiptNotificationRequest {
  merchantId: string;
  merchantName: string;
  purchaseAmount: number;
  receiptDate: string;
  customerName?: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function buildMerchantNotificationHtml(data: MerchantReceiptNotificationRequest): string {
  const primaryColor = "#2a9d8f";
  const customerDisplay = data.customerName ? escapeHtml(data.customerName) : "A PawBucks customer";
  const confirmUrl = `${APP_URL}/merchant-dashboard?tab=confirmations`;

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
          <tr>
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <img src="${LOGO_URL}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
            </td>
          </tr>
          <tr>
            <td style="padding: 0 32px 40px 32px;">
              <h1 style="margin: 0 0 8px 0; font-size: 22px; font-weight: 700; color: #1f2937; text-align: center;">New Receipt Submitted</h1>
              <p style="margin: 0 0 24px 0; font-size: 14px; color: #6b7280; text-align: center; line-height: 1.5;">
                ${customerDisplay} just submitted a purchase receipt for <strong>${escapeHtml(data.merchantName)}</strong>.
              </p>
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Purchase Amount</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">$${data.purchaseAmount.toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280; border-bottom: 1px solid #f3f4f6;">Receipt Date</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right; border-bottom: 1px solid #f3f4f6;">${escapeHtml(data.receiptDate)}</td>
                </tr>
                <tr>
                  <td style="padding: 12px 16px; font-size: 14px; color: #6b7280;">Customer</td>
                  <td style="padding: 12px 16px; font-size: 14px; font-weight: 600; color: #1f2937; text-align: right;">${customerDisplay}</td>
                </tr>
              </table>
              <div style="background-color: #f0fdfa; border: 1px solid #99f6e4; border-radius: 8px; padding: 16px; margin-bottom: 24px;">
                <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: ${primaryColor};">📋 Action Required</p>
                <p style="margin: 0; font-size: 13px; color: #374151; line-height: 1.5;">
                  Please review and confirm this sale on your dashboard. Confirming helps the customer receive their PawBucks faster.
                </p>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <a href="${confirmUrl}" target="_blank" style="display: inline-block; background-color: ${primaryColor}; color: #ffffff; text-decoration: none; font-size: 16px; font-weight: 600; padding: 14px 32px; border-radius: 8px;">
                      Review &amp; Confirm Sale
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin: 24px 0 0 0; font-size: 12px; color: #9ca3af; text-align: center; line-height: 1.5;">
                You can also view all pending receipts on your Merchant Dashboard under Sale Confirmations.
              </p>
            </td>
          </tr>
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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const resend = new Resend(resendApiKey);

    if (!resendApiKey) {
      console.error("Missing RESEND_API_KEY");
      return new Response(
        JSON.stringify({ error: "Email service not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

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

    const body: MerchantReceiptNotificationRequest = await req.json();

    if (!body.merchantId || !body.merchantName || !body.purchaseAmount || !body.receiptDate) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get the merchant's account user and direct business email
    const { data: merchant } = await supabase
      .from("merchants")
      .select("user_id, email")
      .eq("id", body.merchantId)
      .single();

    if (!merchant) {
      console.log("No merchant found for id:", body.merchantId);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "Merchant not found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: ownerProfile } = merchant.user_id
      ? await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", merchant.user_id)
          .single()
      : { data: null };

    const recipientEmail = ownerProfile?.email || merchant.email;
    if (!recipientEmail) {
      console.log("No email found for merchant:", {
        merchantId: body.merchantId,
        merchantUserId: merchant.user_id,
      });
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "No merchant email found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get customer name
    const { data: customerProfile } = await supabase
      .from("profiles")
      .select("full_name")
      .eq("id", userData.user.id)
      .single();

    const dataWithCustomer = {
      ...body,
      customerName: customerProfile?.full_name || body.customerName,
    };

    const html = buildMerchantNotificationHtml(dataWithCustomer);

    const { error: sendError } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [recipientEmail],
      subject: `New Receipt Submission — $${body.purchaseAmount.toFixed(2)} at ${body.merchantName}`,
      html,
    });

    if (sendError) {
      console.error("Failed to send merchant notification:", sendError);
      return new Response(
        JSON.stringify({ error: sendError.message || "Email send failed" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Merchant receipt notification sent to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in notify-merchant-receipt:", error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
