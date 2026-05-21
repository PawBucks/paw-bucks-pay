import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-secret',
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
  const tierText = tierInfo ? `${tierInfo.tierName} • ${tierInfo.multiplier}x` : '';
  const serviceName = items.length === 1 ? items[0].name : `${items.length} items purchased`;
  const shortReceiptId = receiptId.substring(0, 12).toUpperCase();

  // ── Items
  const itemRowsHtml = items.map((item) => `
    <tr>
      <td style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:400;">${item.name}</td>
      <td align="right" style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:500;white-space:nowrap;">$${item.price.toFixed(2)}</td>
    </tr>
  `).join('');

  // ── Payment summary rows
  let summaryRowsHtml = `
    <tr><td style="padding:6px 0;font-size:14px;color:#475569;">Subtotal</td>
        <td align="right" style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:500;">$${subtotal.toFixed(2)}</td></tr>`;

  if (pawbucksApplied > 0) {
    summaryRowsHtml += `
    <tr><td style="padding:6px 0;font-size:14px;color:#16a34a;font-weight:500;">🐾 PawBucks Applied</td>
        <td align="right" style="padding:6px 0;font-size:14px;color:#16a34a;font-weight:600;">-$${pawbucksApplied.toFixed(2)}</td></tr>`;
  }
  if (surcharge && surcharge > 0) {
    summaryRowsHtml += `
    <tr><td style="padding:6px 0;font-size:14px;color:#475569;">Surcharge</td>
        <td align="right" style="padding:6px 0;font-size:14px;color:#0f172a;">$${surcharge.toFixed(2)}</td></tr>`;
  }
  summaryRowsHtml += `
    <tr><td style="padding:6px 0;font-size:14px;color:#475569;">Card Charged</td>
        <td align="right" style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:500;">$${cardAmount.toFixed(2)}</td></tr>`;

  const paymentMethodText = cardBrand && cardLast4 ? `${cardBrand} ending in ${cardLast4}` : '';

  // ── Rewards earned card (dark gradient teal accent)
  const rewardsCardHtml = pawbucksEarned && pawbucksEarned > 0 ? `
  <tr><td style="padding:16px 16px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#0a1f26;background-image:linear-gradient(135deg,#0a1f26 0%,#0e3040 100%);border-radius:14px;">
      <tr>
        <td style="padding:18px 20px;" valign="middle">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
            <td width="44" valign="middle" style="width:44px;">
              <table cellpadding="0" cellspacing="0" role="presentation" style="background:rgba(18,168,179,0.2);border:1px solid rgba(18,168,179,0.3);border-radius:12px;">
                <tr><td style="width:44px;height:44px;text-align:center;font-size:20px;line-height:44px;">🐾</td></tr>
              </table>
            </td>
            <td valign="middle" style="padding-left:14px;">
              <p style="margin:0 0 3px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#6ab8c0;">Rewards Earned${tierText ? ` • ${tierText}` : ''}</p>
              <p style="margin:0;font-size:20px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">+${pawbucksEarned.toLocaleString()} PawBucks</p>
              ${walletBalance !== undefined ? `<p style="margin:2px 0 0;font-size:11px;color:#6ab8c0;">New balance: ${walletBalance.toLocaleString()} PB${expiringPawBucks && expiringPawBucks.amount > 0 ? ` • ${expiringPawBucks.amount.toLocaleString()} expiring in ${expiringPawBucks.daysLeft}d` : ''}</p>` : ''}
            </td>
          </tr></table>
        </td>
      </tr>
    </table>
  </td></tr>` : '';

  // ── Spliced insurance breakdown (optional)
  const splicedHtml = splicedBreakdown ? `
  <tr><td style="padding:16px 16px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;">Insurance Breakdown</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
          ${splicedBreakdown.insuranceCovered ? `<tr><td style="padding:6px 0;font-size:14px;color:#475569;">Insurance Covered</td><td align="right" style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">$${splicedBreakdown.insuranceCovered.toFixed(2)}</td></tr>` : ''}
          ${splicedBreakdown.ownerResponsibility ? `<tr><td style="padding:6px 0;font-size:14px;color:#475569;">Your Responsibility</td><td align="right" style="padding:6px 0;font-size:14px;color:#0f172a;font-weight:600;">$${splicedBreakdown.ownerResponsibility.toFixed(2)}</td></tr>` : ''}
          ${splicedBreakdown.pendingFromCarrier ? `<tr><td style="padding:6px 0;font-size:14px;color:#b45309;">⏳ Pending from Carrier</td><td align="right" style="padding:6px 0;font-size:14px;color:#b45309;font-weight:600;">$${splicedBreakdown.pendingFromCarrier.toFixed(2)}</td></tr>` : ''}
        </table>
      </td></tr>
    </table>
  </td></tr>` : '';

  // ── Merchant card
  const merchantSectionHtml = `
  <tr><td style="padding:16px 16px 0;">
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;">
      <tr><td style="padding:16px 18px;">
        <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;">Paid To</p>
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation"><tr>
          <td width="44" valign="middle" style="width:44px;">
            <table cellpadding="0" cellspacing="0" role="presentation" style="background:#e8f9fa;border:1px solid #caeaee;border-radius:10px;">
              <tr><td style="width:44px;height:44px;text-align:center;font-size:18px;line-height:44px;">🏪</td></tr>
            </table>
          </td>
          <td valign="middle" style="padding-left:12px;">
            <p style="margin:0 0 2px;font-size:15px;font-weight:600;color:#0f172a;">${merchantName}</p>
            ${merchantDescription ? `<p style="margin:0 0 2px;font-size:12px;color:#64748b;">${merchantDescription}</p>` : ''}
            ${merchantLocation ? `<p style="margin:0;font-size:12px;color:#64748b;">${merchantLocation}</p>` : ''}
          </td>
        </tr></table>
        ${merchantProfileUrl ? `<p style="margin:12px 0 0;font-size:12px;"><a href="${merchantProfileUrl}" style="color:#12a8b3;text-decoration:none;font-weight:600;">View Merchant Profile →</a></p>` : ''}
      </td></tr>
    </table>
  </td></tr>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0" />
  <title>Receipt — ${merchantName} — PawBucks</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f5;font-family:'Inter',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;color:#0f172a;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f0f4f5;">
    <tr><td align="center" style="padding:0 0 48px;">

      <table width="480" cellpadding="0" cellspacing="0" role="presentation" style="max-width:480px;width:100%;">

        <!-- HERO -->
        <tr><td style="background:#0a1f26;padding:36px 24px 28px;text-align:center;">
          <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="64" height="64" style="display:block;margin:0 auto 16px;width:64px;height:64px;">
          <table cellpadding="0" cellspacing="0" role="presentation" align="center" style="margin:0 auto 12px;background:rgba(22,163,74,0.15);border:1px solid rgba(22,163,74,0.3);border-radius:999px;">
            <tr><td style="padding:4px 12px;font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#4ade80;">● Payment Successful</td></tr>
          </table>
          <p style="margin:0 0 4px;font-size:22px;font-weight:700;color:#ffffff;">Receipt</p>
          <p style="margin:0;font-size:13px;color:#6ab8c0;">${formattedDate}</p>
        </td></tr>

        <!-- AMOUNT PILL -->
        <tr><td style="padding:0 24px;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#12a8b3;border-radius:0 0 16px 16px;">
            <tr>
              <td style="padding:14px 24px;font-size:12px;font-weight:500;color:rgba(255,255,255,0.85);text-transform:uppercase;letter-spacing:1px;">Total Paid</td>
              <td align="right" style="padding:14px 24px;font-size:26px;font-weight:700;color:#ffffff;letter-spacing:-0.02em;">$${totalPaid.toFixed(2)}</td>
            </tr>
          </table>
        </td></tr>

        ${rewardsCardHtml}

        <!-- TRANSACTION DETAILS + ITEMS -->
        <tr><td style="padding:16px 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;">
            <tr><td style="padding:16px 18px;border-bottom:1px solid #f1f5f9;">
              <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;">Transaction</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                <tr>
                  <td style="padding-bottom:12px;width:50%;">
                    <p style="margin:0 0 2px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">Service</p>
                    <p style="margin:0;font-size:14px;font-weight:500;color:#0f172a;">${serviceName}</p>
                  </td>
                  <td style="padding-bottom:12px;width:50%;">
                    <p style="margin:0 0 2px;font-size:10px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:#94a3b8;">Receipt ID</p>
                    <p style="margin:0;font-family:'SF Mono','Fira Code',monospace;font-size:13px;color:#475569;letter-spacing:0.02em;">${shortReceiptId}</p>
                  </td>
                </tr>
              </table>
            </td></tr>
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;">Items</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">${itemRowsHtml}</table>
            </td></tr>
          </table>
        </td></tr>

        <!-- PAYMENT SUMMARY -->
        <tr><td style="padding:16px 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;">
            <tr><td style="padding:16px 18px;">
              <p style="margin:0 0 12px;font-size:10px;font-weight:600;letter-spacing:1.2px;text-transform:uppercase;color:#94a3b8;">Payment Summary</p>
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                ${summaryRowsHtml}
                <tr><td colspan="2" style="padding:6px 0 0;"><div style="border-top:1px solid #f1f5f9;height:1px;line-height:1px;font-size:0;">&nbsp;</div></td></tr>
                <tr>
                  <td style="padding:12px 0 0;font-size:15px;font-weight:700;color:#0f172a;">Total Paid</td>
                  <td align="right" style="padding:12px 0 0;font-size:15px;font-weight:700;color:#0f172a;">$${totalPaid.toFixed(2)}</td>
                </tr>
              </table>
              <table cellpadding="0" cellspacing="0" role="presentation" style="margin-top:10px;background:#dcfce7;border:1px solid #bbf7d0;border-radius:999px;">
                <tr><td style="padding:5px 12px;font-size:12px;font-weight:600;color:#16a34a;">✓ Approved${paymentMethodText ? ` • ${paymentMethodText}` : ''}</td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        ${splicedHtml}
        ${merchantSectionHtml}

        <!-- CTA -->
        <tr><td style="padding:16px 16px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:14px;">
            <tr><td style="padding:18px 20px;text-align:center;">
              <p style="margin:0 0 4px;font-size:14px;font-weight:600;color:#0f172a;">Use Your PawBucks</p>
              <p style="margin:0 0 14px;font-size:12px;color:#64748b;">Spend PawBucks on pet services from trusted local businesses.</p>
              <table cellpadding="0" cellspacing="0" role="presentation" align="center" style="margin:0 auto;">
                <tr><td style="background:#12a8b3;border-radius:10px;">
                  <a href="https://pawbucks.app/discover" style="display:block;padding:12px 24px;font-size:13px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">Explore PawBucks Merchants</a>
                </td></tr>
              </table>
            </td></tr>
          </table>
        </td></tr>

        <!-- FOOTER -->
        <tr><td style="padding:24px 24px 0;text-align:center;color:#94a3b8;font-size:11px;line-height:1.7;">
          <p style="margin:0 0 4px;">Questions? <a href="mailto:support@pawbucks.app" style="color:#12a8b3;text-decoration:none;">support@pawbucks.app</a></p>
          <p style="margin:0 0 4px;">PawBucks, Inc. <span style="color:#cbd5e1;">·</span> Electronically generated receipt</p>
          <p style="margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
        </td></tr>

      </table>

    </td></tr>
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
