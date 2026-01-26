import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoicePaidNotificationParams {
  merchantEmail: string;
  merchantName: string;
  invoiceNumber: string;
  invoiceTitle?: string;
  clientName: string;
  clientEmail: string;
  amountPaid: number;
  tipAmount?: number;
  pawbucksUsed?: number;
  paymentMethod: 'credit_card' | 'pawbucks' | 'mixed';
  paymentDate: string;
  invoiceTotal: number;
  amountDue?: number;
  invoiceId: string;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function getPaymentMethodLabel(method: string, pawbucksUsed?: number): string {
  if (method === 'pawbucks') {
    return 'PawBucks';
  } else if (method === 'mixed' || (pawbucksUsed && pawbucksUsed > 0)) {
    return 'Credit Card + PawBucks';
  }
  return 'Credit Card';
}

function generateInvoicePaidEmailHtml(params: InvoicePaidNotificationParams): string {
  const {
    merchantName,
    invoiceNumber,
    invoiceTitle,
    clientName,
    clientEmail,
    amountPaid,
    tipAmount = 0,
    pawbucksUsed = 0,
    paymentMethod,
    paymentDate,
    invoiceTotal,
    amountDue = 0,
    invoiceId,
  } = params;

  const logoUrl = "https://paw-bucks-pay.lovable.app/logo.png";
  const formattedDate = formatDate(paymentDate);
  const paymentMethodLabel = getPaymentMethodLabel(paymentMethod, pawbucksUsed);
  const pawbucksValueUSD = pawbucksUsed * 0.001;
  const totalPaymentReceived = amountPaid + pawbucksValueUSD;
  const isFullyPaid = amountDue <= 0;

  // Payment breakdown rows
  const paymentBreakdownHtml = `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:16px;">
      ${pawbucksUsed > 0 ? `
        <tr>
          <td style="font-size:14px; color:#374151; padding:8px 0; border-bottom:1px solid #e5e7eb;">
            PawBucks Applied
          </td>
          <td align="right" style="font-size:14px; color:#16a34a; padding:8px 0; border-bottom:1px solid #e5e7eb;">
            ${pawbucksUsed.toLocaleString()} PB (${formatCurrency(pawbucksValueUSD)})
          </td>
        </tr>
      ` : ''}
      ${amountPaid > 0 ? `
        <tr>
          <td style="font-size:14px; color:#374151; padding:8px 0; border-bottom:1px solid #e5e7eb;">
            Card Payment
          </td>
          <td align="right" style="font-size:14px; color:#374151; padding:8px 0; border-bottom:1px solid #e5e7eb;">
            ${formatCurrency(amountPaid)}
          </td>
        </tr>
      ` : ''}
      ${tipAmount > 0 ? `
        <tr>
          <td style="font-size:14px; color:#374151; padding:8px 0; border-bottom:1px solid #e5e7eb;">
            Tip Included
          </td>
          <td align="right" style="font-size:14px; color:#16a34a; padding:8px 0; border-bottom:1px solid #e5e7eb;">
            ${formatCurrency(tipAmount)}
          </td>
        </tr>
      ` : ''}
      <tr>
        <td style="font-size:16px; font-weight:bold; color:#111827; padding:12px 0;">
          Total Received
        </td>
        <td align="right" style="font-size:16px; font-weight:bold; color:#16a34a; padding:12px 0;">
          ${formatCurrency(totalPaymentReceived)}
        </td>
      </tr>
    </table>
  `;

  // Status badge
  const statusBadgeHtml = isFullyPaid
    ? `<span style="display:inline-block; background-color:#dcfce7; color:#166534; padding:6px 16px; border-radius:16px; font-size:14px; font-weight:600;">✓ Fully Paid</span>`
    : `<span style="display:inline-block; background-color:#fef3c7; color:#92400e; padding:6px 16px; border-radius:16px; font-size:14px; font-weight:600;">Partial Payment</span>`;

  // Remaining balance section (only if not fully paid)
  const remainingBalanceHtml = !isFullyPaid ? `
    <tr>
      <td style="padding:0 20px 20px;">
        <table width="100%" cellpadding="16" cellspacing="0" style="background-color:#fef3c7; border-radius:8px;">
          <tr>
            <td>
              <p style="margin:0 0 4px 0; font-size:14px; color:#92400e; font-weight:600;">Remaining Balance</p>
              <p style="margin:0; font-size:24px; font-weight:bold; color:#92400e;">${formatCurrency(amountDue)}</p>
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
  <title>Invoice Payment Received</title>
</head>

<body style="margin:0; padding:0; background-color:#f5f7fa; font-family: Arial, Helvetica, sans-serif;">

  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f7fa; padding:20px;">
    <tr>
      <td align="center">

        <table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:10px; overflow:hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">

          <!-- Header -->
          <tr>
            <td style="padding:24px; text-align:center; background: linear-gradient(135deg, #16a34a 0%, #15803d 100%);">
              <img 
                src="${logoUrl}" 
                alt="PawBucks" 
                width="120"
                style="display:block; margin:0 auto 12px; max-width:120px;"
              />
              <h1 style="margin:0; font-size:24px; color:#ffffff; font-weight:bold;">
                💰 Payment Received!
              </h1>
              <p style="margin:8px 0 0 0; font-size:14px; color:rgba(255,255,255,0.9);">
                Invoice #${invoiceNumber}
              </p>
            </td>
          </tr>

          <!-- Greeting -->
          <tr>
            <td style="padding:24px 20px 16px;">
              <p style="margin:0; font-size:16px; color:#374151;">
                Hi <strong>${merchantName}</strong>,
              </p>
              <p style="margin:12px 0 0 0; font-size:16px; color:#374151;">
                Great news! You've received a payment for your invoice.
              </p>
            </td>
          </tr>

          <!-- Invoice Info Card -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table width="100%" cellpadding="16" cellspacing="0" style="background-color:#f9fafb; border-radius:8px; border:1px solid #e5e7eb;">
                <tr>
                  <td>
                    <table width="100%">
                      <tr>
                        <td>
                          <p style="margin:0 0 4px 0; font-size:12px; color:#6b7280; text-transform:uppercase;">Invoice</p>
                          <p style="margin:0; font-size:16px; font-weight:bold; color:#111827;">#${invoiceNumber}</p>
                          ${invoiceTitle ? `<p style="margin:4px 0 0 0; font-size:14px; color:#6b7280;">${invoiceTitle}</p>` : ''}
                        </td>
                        <td align="right">
                          ${statusBadgeHtml}
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Client Info -->
          <tr>
            <td style="padding:0 20px 20px;">
              <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280; text-transform:uppercase;">Paid By</p>
              <p style="margin:0; font-size:16px; color:#111827; font-weight:600;">${clientName}</p>
              <p style="margin:4px 0 0 0; font-size:14px; color:#6b7280;">${clientEmail}</p>
            </td>
          </tr>

          <!-- Payment Details -->
          <tr>
            <td style="padding:0 20px 20px;">
              <p style="margin:0 0 12px 0; font-size:12px; color:#6b7280; text-transform:uppercase;">Payment Details</p>
              
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:12px;">
                <tr>
                  <td style="font-size:14px; color:#6b7280; padding:4px 0;">Payment Method</td>
                  <td align="right" style="font-size:14px; color:#111827; padding:4px 0;">${paymentMethodLabel}</td>
                </tr>
                <tr>
                  <td style="font-size:14px; color:#6b7280; padding:4px 0;">Date & Time</td>
                  <td align="right" style="font-size:14px; color:#111827; padding:4px 0;">${formattedDate}</td>
                </tr>
                <tr>
                  <td style="font-size:14px; color:#6b7280; padding:4px 0;">Invoice Total</td>
                  <td align="right" style="font-size:14px; color:#111827; padding:4px 0;">${formatCurrency(invoiceTotal)}</td>
                </tr>
              </table>

              <div style="border-top:2px solid #e5e7eb; padding-top:16px;">
                ${paymentBreakdownHtml}
              </div>
            </td>
          </tr>

          <!-- Remaining Balance (if any) -->
          ${remainingBalanceHtml}

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 20px 24px; text-align:center;">
              <a href="https://paw-bucks-pay.lovable.app/merchant/invoicing" style="display:inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:16px;">
                View Invoice Details
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; background-color:#f9fafb; text-align:center; border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280;">
                This is an automated notification from PawBucks.
              </p>
              <p style="margin:0; font-size:12px; color:#6b7280;">
                Questions? Contact support@pawbucks.app
              </p>
              <p style="margin:12px 0 0 0; font-size:11px; color:#9ca3af;">
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
      console.log("[INVOICE_PAID_NOTIFICATION] RESEND_API_KEY not configured, skipping notification email");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const resend = new Resend(resendApiKey);
    const params: InvoicePaidNotificationParams = await req.json();

    console.log('[INVOICE_PAID_NOTIFICATION] Sending notification to merchant:', params.merchantEmail);
    console.log('[INVOICE_PAID_NOTIFICATION] Invoice details:', {
      invoiceNumber: params.invoiceNumber,
      clientName: params.clientName,
      amountPaid: params.amountPaid,
      paymentMethod: params.paymentMethod,
    });

    const html = generateInvoicePaidEmailHtml(params);

    const { data, error } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [params.merchantEmail],
      subject: `💰 Payment Received - Invoice #${params.invoiceNumber} - ${formatCurrency(params.amountPaid + (params.pawbucksUsed || 0) * 0.001)}`,
      html,
    });

    if (error) {
      console.error('[INVOICE_PAID_NOTIFICATION] Failed to send notification email:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[INVOICE_PAID_NOTIFICATION] ✅ Merchant notification email sent successfully:', data);
    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[INVOICE_PAID_NOTIFICATION] Error sending notification email:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
