import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
  items: ReceiptItem[];
  subtotal: number;
  pawbucksApplied: number;
  surcharge?: number;
  cardAmount: number;
  totalPaid: number;
  cardBrand?: string;
  cardLast4?: string;
  pawbucksEarned?: number;
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
    items,
    subtotal,
    pawbucksApplied,
    surcharge,
    cardAmount,
    totalPaid,
    cardBrand,
    cardLast4,
    pawbucksEarned,
    splicedBreakdown,
    tierInfo,
  } = params;

  const logoUrl = "https://paw-bucks-pay.lovable.app/logo.png";
  const formattedDate = formatDate(transactionDate);
  
  // Generate items rows
  const itemsHtml = items.map(item => `
    <tr>
      <td style="font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb; padding:8px;">
        ${item.name}
      </td>
      <td align="right" style="font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb; padding:8px;">
        $${item.price.toFixed(2)}
      </td>
    </tr>
  `).join('');

  // PawBucks applied row (only if > 0)
  const pawbucksAppliedHtml = pawbucksApplied > 0 ? `
    <tr>
      <td style="font-size:14px; padding:4px 0;">PawBucks Applied</td>
      <td align="right" style="font-size:14px; color:#16a34a; padding:4px 0;">
        -$${pawbucksApplied.toFixed(2)}
      </td>
    </tr>
  ` : '';

  // Surcharge row (only if > 0)
  const surchargeHtml = surcharge && surcharge > 0 ? `
    <tr>
      <td style="font-size:14px; padding:4px 0;">Surcharge</td>
      <td align="right" style="font-size:14px; padding:4px 0;">
        $${surcharge.toFixed(2)}
      </td>
    </tr>
  ` : '';

  // PawBucks earned section (only if > 0) - includes tier info if provided
  const tierText = tierInfo ? `(${tierInfo.tierName} ${tierInfo.multiplier}x)` : '';
  const pawbucksEarnedHtml = pawbucksEarned && pawbucksEarned > 0 ? `
    <tr>
      <td style="padding:20px;">
        <table width="100%" cellpadding="16" cellspacing="0" style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius:8px;">
          <tr>
            <td align="center">
              <p style="margin:0 0 4px 0; font-size:14px; color:#92400e;">🐾 You Earned ${tierText}</p>
              <p style="margin:0; font-size:28px; font-weight:bold; color:#92400e;">${pawbucksEarned} PawBucks</p>
              <p style="margin:4px 0 0 0; font-size:12px; color:#a16207;">Added to your wallet!</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  ` : '';

  // Spliced breakdown section for insurance claims (only if provided)
  const splicedBreakdownHtml = splicedBreakdown ? `
    <tr>
      <td style="padding:0 20px 20px;">
        <table width="100%" style="background:#f0f9ff; border:1px solid #bae6fd; border-radius:8px; padding:12px;">
          <tr>
            <td colspan="2" style="font-size:14px; font-weight:bold; color:#0369a1; padding-bottom:8px; border-bottom:1px solid #bae6fd;">
              📋 Payment Breakdown
            </td>
          </tr>
          ${splicedBreakdown.insuranceCovered ? `
          <tr>
            <td style="font-size:13px; color:#0c4a6e; padding:6px 0;">Insurance Covered:</td>
            <td align="right" style="font-size:13px; color:#0c4a6e; padding:6px 0;">$${splicedBreakdown.insuranceCovered.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${splicedBreakdown.ownerResponsibility ? `
          <tr>
            <td style="font-size:13px; color:#0c4a6e; padding:6px 0;">Your Responsibility:</td>
            <td align="right" style="font-size:13px; color:#0c4a6e; padding:6px 0;">$${splicedBreakdown.ownerResponsibility.toFixed(2)}</td>
          </tr>
          ` : ''}
          ${splicedBreakdown.pendingFromCarrier ? `
          <tr>
            <td style="font-size:13px; color:#f59e0b; padding:6px 0;">⏳ Pending from Carrier:</td>
            <td align="right" style="font-size:13px; color:#f59e0b; padding:6px 0;">$${splicedBreakdown.pendingFromCarrier.toFixed(2)}</td>
          </tr>
          ` : ''}
        </table>
      </td>
    </tr>
  ` : '';

  // Payment method display
  const paymentMethodHtml = cardBrand && cardLast4 
    ? `Payment Method: ${cardBrand} ending in ${cardLast4}<br/>`
    : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>PawBucks Receipt</title>
</head>

<body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:20px;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden;">

          <!-- Header / Logo -->
          <tr>
            <td style="padding:24px; text-align:center; background-color:#0f172a;">
              <img 
                src="${logoUrl}" 
                alt="PawBucks" 
                width="140"
                style="display:block; margin:0 auto 12px; max-width:140px;"
              />
              <p style="margin:0; font-size:14px; color:#e5e7eb;">
                Purchase Receipt
              </p>
            </td>
          </tr>

          <!-- Transaction Meta -->
          <tr>
            <td style="padding:20px;">
              <table width="100%">
                <tr>
                  <td style="font-size:14px; color:#374151;">
                    <strong>Date:</strong> ${formattedDate}
                  </td>
                  <td align="right" style="font-size:14px; color:#374151;">
                    <strong>Receipt #:</strong> ${receiptId.substring(0, 12).toUpperCase()}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Merchant Info -->
          <tr>
            <td style="padding:0 20px 20px;">
              <p style="margin:0; font-size:14px; color:#374151;">
                <strong>Merchant:</strong> ${merchantName}<br/>
                ${merchantLocation ? `<span style="color:#6b7280;">${merchantLocation}</span>` : ''}
              </p>
            </td>
          </tr>

          <!-- Line Items -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                <tr style="background-color:#f3f4f6;">
                  <th align="left" style="font-size:13px; color:#111827; border-bottom:1px solid #e5e7eb; padding:8px;">
                    Item
                  </th>
                  <th align="right" style="font-size:13px; color:#111827; border-bottom:1px solid #e5e7eb; padding:8px;">
                    Amount
                  </th>
                </tr>
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table width="100%">
                <tr>
                  <td style="font-size:14px; padding:4px 0;">Subtotal</td>
                  <td align="right" style="font-size:14px; padding:4px 0;">$${subtotal.toFixed(2)}</td>
                </tr>

                ${pawbucksAppliedHtml}

                ${surchargeHtml}

                <tr>
                  <td style="font-size:14px; padding:4px 0;">Card Charged</td>
                  <td align="right" style="font-size:14px; padding:4px 0;">$${cardAmount.toFixed(2)}</td>
                </tr>

                <tr>
                  <td style="font-size:16px; font-weight:bold; padding-top:12px; border-top:2px solid #e5e7eb;">
                    Total Paid
                  </td>
                  <td align="right" style="font-size:16px; font-weight:bold; padding-top:12px; border-top:2px solid #e5e7eb;">
                    $${totalPaid.toFixed(2)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Spliced Breakdown (for insurance claims) -->
          ${splicedBreakdownHtml}

          <!-- Payment Details -->
          <tr>
            <td style="padding:0 20px 20px;">
              <p style="margin:0; font-size:13px; color:#6b7280;">
                ${paymentMethodHtml}
                Status: <strong style="color:#16a34a;">Approved</strong>
              </p>
            </td>
          </tr>

          <!-- PawBucks Earned -->
          ${pawbucksEarnedHtml}

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 20px 20px; text-align:center;">
              <a href="https://paw-bucks-pay.lovable.app/dashboard" style="display:inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:16px;">
                View Your Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; background-color:#f9fafb; text-align:center;">
              <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280;">
                Questions? Contact support@pawbucks.app
              </p>
              <p style="margin:0; font-size:12px; color:#6b7280;">
                PawBucks, Inc. • This is an electronically generated receipt.
              </p>
              <p style="margin:8px 0 0 0; font-size:11px; color:#9ca3af;">
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
