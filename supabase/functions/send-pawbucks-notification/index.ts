import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PawBucksNotificationRequest {
  recipientEmail: string;
  recipientName: string;
  type: 'credit' | 'debit';
  amount: number;
  reason: string;
  newBalance: number;
  oldBalance: number;
  isSharedMember?: boolean;
  adminNote?: string;
}

function formatPawBucks(amount: number): string {
  return amount.toLocaleString();
}

function formatDollarEquivalent(pawbucks: number): string {
  return `$${(pawbucks / 1000).toFixed(2)}`;
}

function buildCreditEmailHtml(data: PawBucksNotificationRequest): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  return `
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
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #7DD4D4; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(125, 212, 212, 0.3), 0 0 30px rgba(125, 212, 212, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
            </td>
          </tr>
          
          <!-- Credit Banner -->
          <tr>
            <td style="padding: 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #10b981, #059669); border-radius: 12px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px;">PawBucks Credited</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 800; color: #ffffff;">+${formatPawBucks(data.amount)} PB</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">(${formatDollarEquivalent(data.amount)} equivalent)</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Hi ${data.recipientName || 'there'},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Great news! <strong>${formatPawBucks(data.amount)} PawBucks</strong> have been added to your account. Here are the details of this credit:
              </p>
              
              <!-- Transaction Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Transaction Type</td>
                        <td style="text-align: right; font-weight: 600; color: #10b981; font-size: 14px;">Credit (Added)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Amount</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${formatPawBucks(data.amount)} PawBucks (${formatDollarEquivalent(data.amount)})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Reason</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${data.reason}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Previous Balance</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${formatPawBucks(data.oldBalance)} PB</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">New Balance</td>
                        <td style="text-align: right; font-weight: 700; color: #10b981; font-size: 16px;">${formatPawBucks(data.newBalance)} PB</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-top: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Date</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${dateStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${data.isSharedMember ? `
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #92400e;">
                  <strong>Note:</strong> This credit was applied to your shared family wallet.
                </p>
              </div>
              ` : ''}

              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                Your PawBucks can be used toward qualifying purchases with participating partners on the PawBucks platform.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 4px 0;">
                This is an automated notification regarding your PawBucks account.
              </p>
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

function buildDebitEmailHtml(data: PawBucksNotificationRequest): string {
  const dateStr = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
  });

  return `
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
            <td style="background-color: #ffffff; padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
              <h1 style="margin: 0; font-size: 42px; font-weight: 800; letter-spacing: 1px; color: #7DD4D4; text-shadow: 0 0 10px rgba(255, 255, 255, 0.8), 0 0 20px rgba(125, 212, 212, 0.3), 0 0 30px rgba(125, 212, 212, 0.2), 2px 2px 4px rgba(255, 255, 255, 0.9);">PAWBUCKS</h1>
            </td>
          </tr>
          
          <!-- Debit Banner -->
          <tr>
            <td style="padding: 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, #ef4444, #dc2626); border-radius: 12px;">
                <tr>
                  <td style="padding: 24px; text-align: center;">
                    <p style="margin: 0 0 4px 0; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px;">PawBucks Debited</p>
                    <p style="margin: 0; font-size: 36px; font-weight: 800; color: #ffffff;">-${formatPawBucks(data.amount)} PB</p>
                    <p style="margin: 4px 0 0 0; font-size: 16px; color: rgba(255,255,255,0.9);">(${formatDollarEquivalent(data.amount)} equivalent)</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 32px;">
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                Hi ${data.recipientName || 'there'},
              </p>
              <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
                This email is to notify you that <strong>${formatPawBucks(data.amount)} PawBucks</strong> have been deducted from your account. Below are the full details of this adjustment:
              </p>
              
              <!-- Transaction Details Table -->
              <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 0 0 24px 0;">
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Transaction Type</td>
                        <td style="text-align: right; font-weight: 600; color: #ef4444; font-size: 14px;">Debit (Removed)</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Amount</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${formatPawBucks(data.amount)} PawBucks (${formatDollarEquivalent(data.amount)})</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Reason</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${data.reason}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Previous Balance</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${formatPawBucks(data.oldBalance)} PB</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">New Balance</td>
                        <td style="text-align: right; font-weight: 700; color: #ef4444; font-size: 16px;">${formatPawBucks(data.newBalance)} PB</td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style="padding: 16px 20px; border-top: 1px solid #e5e7eb;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="color: #6b7280; font-size: 14px;">Date</td>
                        <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${dateStr}</td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${data.isSharedMember ? `
              <div style="background-color: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 0 0 24px 0;">
                <p style="margin: 0; font-size: 13px; color: #92400e;">
                  <strong>Note:</strong> This debit was applied to your shared family wallet.
                </p>
              </div>
              ` : ''}

              <p style="margin: 0 0 8px 0; font-size: 14px; color: #6b7280; line-height: 1.6;">
                If you believe this adjustment was made in error, please contact our support team for assistance.
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0 0 4px 0;">
                This is an automated notification regarding your PawBucks account.
              </p>
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY not configured");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const resend = new Resend(resendApiKey);
    const data: PawBucksNotificationRequest = await req.json();

    const { recipientEmail, recipientName, type, amount, reason, newBalance, oldBalance, isSharedMember } = data;

    if (!recipientEmail || !type || !amount || !reason) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const subject = type === 'credit'
      ? `✅ ${formatPawBucks(amount)} PawBucks Credited to Your Account`
      : `⚠️ ${formatPawBucks(amount)} PawBucks Debited from Your Account`;

    const html = type === 'credit'
      ? buildCreditEmailHtml(data)
      : buildDebitEmailHtml(data);

    const { error: emailError } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [recipientEmail],
      subject,
      html,
    });

    if (emailError) {
      console.error("Failed to send PawBucks notification email:", emailError);
      return new Response(
        JSON.stringify({ success: false, error: emailError.message }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`PawBucks ${type} notification sent to ${recipientEmail}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('PawBucks notification error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
