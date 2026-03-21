import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReceiptItem {
  name: string;
  price: number;
}

interface ReceiptEmailParams {
  email: string;
  customerName?: string;
  transactionDate: string;
  receiptId: string;
  merchantName: string;
  merchantLocation?: string;
  merchantDescription?: string;
  merchantProfileUrl?: string;
  items: ReceiptItem[];
  subtotal: number;
  pawbucksApplied: number;
  surcharge?: number;
  cardAmount: number;
  totalPaid: number;
  cardBrand?: string;
  cardLast4?: string;
  pawbucksEarned?: number;
  walletBalance?: number;
  expiringPawBucks?: { amount: number; daysLeft: number };
  // Optional spliced breakdown for insurance claims
  splicedBreakdown?: {
    insuranceCovered?: number;
    ownerResponsibility?: number;
    pendingFromCarrier?: number;
  };
  // Optional tier info for rewards display
  tierInfo?: {
    tierName: string;
    multiplier: number;
  };
}

// Format timestamp with explicit US timezone
function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// Format date-only strings (YYYY-MM-DD) without timezone shift
function formatLocalDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[month - 1]} ${day}, ${year}`;
}

function generateReceiptHtml(params: ReceiptEmailParams): string {
  const {
    transactionDate,
    receiptId,
    merchantName,
    merchantLocation,
    merchantDescription,
    merchantProfileUrl,
    items,
    subtotal,
    pawbucksApplied,
    surcharge,
    cardAmount,
    totalPaid,
    cardBrand,
    cardLast4,
    pawbucksEarned,
    walletBalance,
    expiringPawBucks,
    splicedBreakdown,
    tierInfo,
  } = params;

  const formattedDate = formatDate(transactionDate);
  const tierText = tierInfo ? ` (${tierInfo.tierName} ${tierInfo.multiplier}x)` : '';

  // Service name from first item
  const serviceName = items.length > 0 ? items[0].name : 'Purchase';

  // Reward section (only if earned)
  const rewardSectionHtml = pawbucksEarned && pawbucksEarned > 0 ? `
    <!-- Reward Earned Card -->
    <tr>
      <td style="padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 50%, #b45309 100%); border-radius:16px; overflow:hidden;">
          <tr>
            <td style="padding:28px 24px; text-align:center;">
              <p style="margin:0 0 4px; font-size:12px; font-weight:600; letter-spacing:2px; color:rgba(255,255,255,0.85); text-transform:uppercase;">🎉 Reward Earned${tierText}</p>
              <p style="margin:0 0 6px; font-size:36px; font-weight:800; color:#ffffff; line-height:1.1;">+${pawbucksEarned.toLocaleString()} PawBucks</p>
              <p style="margin:0; font-size:13px; color:rgba(255,255,255,0.8);">Added to your PawBucks Wallet</p>
            </td>
          </tr>
          ${walletBalance !== undefined ? `
          <tr>
            <td style="padding:0 24px 20px; text-align:center;">
              <table cellpadding="0" cellspacing="0" style="margin:0 auto; background:rgba(255,255,255,0.15); border-radius:10px; backdrop-filter:blur(10px);">
                <tr>
                  <td style="padding:10px 20px;">
                    <p style="margin:0 0 2px; font-size:11px; color:rgba(255,255,255,0.7); text-transform:uppercase; letter-spacing:1px;">Current Balance</p>
                    <p style="margin:0; font-size:18px; font-weight:700; color:#ffffff;">${walletBalance.toLocaleString()} PawBucks</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ''}
        </table>
      </td>
    </tr>
  ` : '';

  // Transaction details rows
  const detailRows = [
    { label: 'Merchant', value: merchantName },
    { label: 'Service', value: serviceName },
    { label: 'Date', value: formattedDate },
    { label: 'Receipt ID', value: receiptId.substring(0, 12).toUpperCase() },
  ];

  const detailRowsHtml = detailRows.map((row, i) => `
    <tr>
      <td style="padding:14px 0; ${i < detailRows.length - 1 ? 'border-bottom:1px solid #f1f5f9;' : ''}">
        <p style="margin:0 0 3px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:0.5px;">${row.label}</p>
        <p style="margin:0; font-size:15px; color:#1e293b; font-weight:500;">${row.value}</p>
      </td>
    </tr>
  `).join('');

  // Payment summary rows
  let paymentRowsHtml = `
    <tr>
      <td style="font-size:14px; color:#475569; padding:8px 0;">Subtotal</td>
      <td align="right" style="font-size:14px; color:#1e293b; font-weight:500; padding:8px 0;">$${subtotal.toFixed(2)}</td>
    </tr>
  `;

  if (pawbucksApplied > 0) {
    paymentRowsHtml += `
    <tr>
      <td style="font-size:14px; color:#16a34a; padding:8px 0;">PawBucks Applied</td>
      <td align="right" style="font-size:14px; color:#16a34a; font-weight:600; padding:8px 0;">-$${pawbucksApplied.toFixed(2)}</td>
    </tr>`;
  }

  if (surcharge && surcharge > 0) {
    paymentRowsHtml += `
    <tr>
      <td style="font-size:14px; color:#475569; padding:8px 0;">Surcharge</td>
      <td align="right" style="font-size:14px; color:#1e293b; padding:8px 0;">$${surcharge.toFixed(2)}</td>
    </tr>`;
  }

  paymentRowsHtml += `
    <tr>
      <td style="font-size:14px; color:#475569; padding:8px 0;">Card Charged</td>
      <td align="right" style="font-size:14px; color:#1e293b; font-weight:500; padding:8px 0;">$${cardAmount.toFixed(2)}</td>
    </tr>
  `;

  // Payment method display
  const paymentMethodText = cardBrand && cardLast4 
    ? `${cardBrand} ending in ${cardLast4}` 
    : '';

  // Spliced breakdown for insurance claims
  const splicedHtml = splicedBreakdown ? `
    <tr>
      <td style="padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:12px;">
          <tr>
            <td style="padding:16px;">
              <p style="margin:0 0 12px; font-size:12px; font-weight:600; color:#0369a1; text-transform:uppercase; letter-spacing:1px;">📋 Payment Breakdown</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                ${splicedBreakdown.insuranceCovered ? `
                <tr>
                  <td style="font-size:13px; color:#0c4a6e; padding:4px 0;">Insurance Covered</td>
                  <td align="right" style="font-size:13px; color:#0c4a6e; font-weight:600; padding:4px 0;">$${splicedBreakdown.insuranceCovered.toFixed(2)}</td>
                </tr>` : ''}
                ${splicedBreakdown.ownerResponsibility ? `
                <tr>
                  <td style="font-size:13px; color:#0c4a6e; padding:4px 0;">Your Responsibility</td>
                  <td align="right" style="font-size:13px; color:#0c4a6e; font-weight:600; padding:4px 0;">$${splicedBreakdown.ownerResponsibility.toFixed(2)}</td>
                </tr>` : ''}
                ${splicedBreakdown.pendingFromCarrier ? `
                <tr>
                  <td style="font-size:13px; color:#f59e0b; padding:4px 0;">⏳ Pending from Carrier</td>
                  <td align="right" style="font-size:13px; color:#f59e0b; font-weight:600; padding:4px 0;">$${splicedBreakdown.pendingFromCarrier.toFixed(2)}</td>
                </tr>` : ''}
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  // Merchant info section
  const merchantSectionHtml = `
    <tr>
      <td style="padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; border-radius:12px; border:1px solid #e2e8f0;">
          <tr>
            <td style="padding:20px;">
              <p style="margin:0 0 10px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1.5px;">About This Merchant</p>
              <p style="margin:0 0 4px; font-size:16px; font-weight:700; color:#1e293b;">${merchantName}</p>
              ${merchantDescription ? `<p style="margin:0 0 4px; font-size:13px; color:#64748b;">${merchantDescription}</p>` : ''}
              ${merchantLocation ? `<p style="margin:0; font-size:13px; color:#94a3b8;">${merchantLocation}</p>` : ''}
              ${merchantProfileUrl ? `
              <table cellpadding="0" cellspacing="0" style="margin-top:14px;">
                <tr>
                  <td style="background:#f1f5f9; border-radius:8px; border:1px solid #e2e8f0;">
                    <a href="${merchantProfileUrl}" style="display:block; padding:10px 20px; font-size:13px; font-weight:600; color:#475569; text-decoration:none;">View Merchant Profile →</a>
                  </td>
                </tr>
              </table>` : ''}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  // CTA section
  const ctaSectionHtml = `
    <tr>
      <td style="padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 100%); border-radius:12px;">
          <tr>
            <td style="padding:24px; text-align:center;">
              <p style="margin:0 0 6px; font-size:15px; font-weight:600; color:#ffffff;">Use Your PawBucks</p>
              <p style="margin:0 0 16px; font-size:13px; color:#94a3b8;">Spend PawBucks on pet services from trusted local businesses.</p>
              <table cellpadding="0" cellspacing="0" style="margin:0 auto;">
                <tr>
                  <td style="background:linear-gradient(135deg, #f59e0b 0%, #d97706 100%); border-radius:10px;">
                    <a href="https://pawbucks.app/explore" style="display:block; padding:14px 32px; font-size:14px; font-weight:700; color:#ffffff; text-decoration:none; letter-spacing:0.3px;">Explore PawBucks Merchants</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `;

  // Wallet balance footer strip
  const walletStripHtml = walletBalance !== undefined ? `
    <tr>
      <td style="padding:0 24px 24px;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#fffbeb; border:1px solid #fde68a; border-radius:12px;">
          <tr>
            <td style="padding:16px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td>
                    <p style="margin:0 0 2px; font-size:12px; font-weight:600; color:#92400e; text-transform:uppercase; letter-spacing:0.5px;">🐾 PawBucks Wallet</p>
                    <p style="margin:0; font-size:16px; font-weight:700; color:#78350f;">Balance: ${walletBalance.toLocaleString()} PawBucks</p>
                  </td>
                  ${expiringPawBucks && expiringPawBucks.amount > 0 ? `
                  <td align="right" valign="top">
                    <p style="margin:0; font-size:12px; color:#b45309; font-weight:500;">Expiring: ${expiringPawBucks.amount.toLocaleString()} in ${expiringPawBucks.daysLeft} days</p>
                  </td>` : ''}
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PawBucks Receipt</title>
</head>
<body style="margin:0; padding:0; background-color:#f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; -webkit-font-smoothing:antialiased;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9; padding:32px 16px;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:20px; overflow:hidden; box-shadow:0 4px 24px rgba(0,0,0,0.06);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg, #0f172a 0%, #1e293b 60%, #0f172a 100%); padding:40px 24px 36px; text-align:center;">
              <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
              <p style="margin:0 0 8px; font-size:20px; font-weight:600; color:#ffffff;">Payment Successful</p>
              <p style="margin:0; font-size:13px; color:#94a3b8;">Thanks for supporting a local pet business!</p>
            </td>
          </tr>

          ${rewardSectionHtml}

          <!-- Transaction Details -->
          <tr>
            <td style="padding:0 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 16px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1.5px;">Transaction Details</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${detailRowsHtml}
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Payment Summary -->
          <tr>
            <td style="padding:0 24px 24px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff; border-radius:12px; border:1px solid #e2e8f0;">
                <tr>
                  <td style="padding:20px;">
                    <p style="margin:0 0 16px; font-size:11px; font-weight:600; color:#94a3b8; text-transform:uppercase; letter-spacing:1.5px;">Payment Summary</p>
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${paymentRowsHtml}
                      <!-- Divider -->
                      <tr>
                        <td colspan="2" style="padding:8px 0;">
                          <div style="border-top:2px solid #e2e8f0;"></div>
                        </td>
                      </tr>
                      <!-- Total -->
                      <tr>
                        <td style="font-size:16px; font-weight:700; color:#0f172a; padding:8px 0;">Total Paid</td>
                        <td align="right" style="font-size:16px; font-weight:700; color:#0f172a; padding:8px 0;">$${totalPaid.toFixed(2)}</td>
                      </tr>
                    </table>
                    <!-- Status -->
                    <table cellpadding="0" cellspacing="0" style="margin-top:14px;">
                      <tr>
                        <td style="background:#f0fdf4; border-radius:8px; padding:8px 14px;">
                          <p style="margin:0; font-size:13px; color:#16a34a; font-weight:600;">Status: Approved ✔</p>
                          ${paymentMethodText ? `<p style="margin:4px 0 0; font-size:12px; color:#4ade80;">${paymentMethodText}</p>` : ''}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          ${splicedHtml}

          ${merchantSectionHtml}

          ${ctaSectionHtml}

          ${walletStripHtml}

          <!-- Footer -->
          <tr>
            <td style="padding:24px; background:#f8fafc; text-align:center; border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 6px; font-size:12px; color:#64748b;">
                Questions? <a href="mailto:support@pawbucks.app" style="color:#0ea5e9; text-decoration:none; font-weight:500;">support@pawbucks.app</a>
              </p>
              <p style="margin:0 0 4px; font-size:12px; color:#94a3b8;">
                PawBucks, Inc. • Electronically generated receipt
              </p>
              <p style="margin:0; font-size:11px; color:#cbd5e1;">
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
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[RECEIPT] RESEND_API_KEY not configured, skipping receipt email");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const resend = new Resend(resendApiKey);
    const params: ReceiptEmailParams = await req.json();

    console.log('[RECEIPT] Sending receipt email to:', params.email);
    console.log('[RECEIPT] Receipt details:', {
      receiptId: params.receiptId,
      merchantName: params.merchantName,
      totalPaid: params.totalPaid,
      itemCount: params.items.length,
    });

    const html = generateReceiptHtml(params);

    const { data, error } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [params.email],
      subject: `Receipt - ${params.merchantName} - $${params.totalPaid.toFixed(2)}`,
      html,
    });

    if (error) {
      console.error('[RECEIPT] Failed to send receipt email:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[RECEIPT] ✅ Receipt email sent successfully:', data);
    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[RECEIPT] Error sending receipt email:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
