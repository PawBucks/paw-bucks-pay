import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InvoiceReceiptRequest {
  invoiceId: string;
  paymentId?: string;
  isResend?: boolean;
}

// Format date-only strings (YYYY-MM-DD) without timezone shift
function formatLocalDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[month - 1]} ${day}, ${year}`;
}

// Format full timestamp
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

function generateReceiptHtml(params: {
  invoice: any;
  items: any[];
  payments: any[];
  merchant: any;
  isResend: boolean;
}): string {
  const { invoice, items, payments, merchant, isResend } = params;

  const logoUrl = "https://pawbucks.app/logo.png";
  const formattedIssueDate = formatLocalDateOnly(invoice.issue_date);
  const formattedPaidDate = invoice.paid_at ? formatDate(invoice.paid_at) : formatDate(new Date().toISOString());
  
  // Generate items rows
  const itemsHtml = items.map(item => `
    <tr>
      <td style="font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb; padding:8px;">
        ${item.description}
      </td>
      <td align="center" style="font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb; padding:8px;">
        ${Number(item.quantity).toFixed(item.unit_type === 'hour' ? 2 : 0)}
      </td>
      <td align="right" style="font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb; padding:8px;">
        $${Number(item.unit_price).toFixed(2)}
      </td>
      <td align="right" style="font-size:14px; color:#374151; border-bottom:1px solid #e5e7eb; padding:8px;">
        $${Number(item.subtotal).toFixed(2)}
      </td>
    </tr>
  `).join('');

  // Generate payment history rows
  const paymentsHtml = payments.map(payment => {
    const paymentDate = new Date(payment.payment_date);
    return `
      <tr>
        <td style="font-size:13px; color:#374151; border-bottom:1px solid #e5e7eb; padding:6px;">
          ${paymentDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
        </td>
        <td style="font-size:13px; color:#374151; border-bottom:1px solid #e5e7eb; padding:6px; text-transform: capitalize;">
          ${payment.payment_method.replace('_', ' ')}
        </td>
        <td style="font-size:13px; color:#374151; border-bottom:1px solid #e5e7eb; padding:6px;">
          ${payment.reference_number || '-'}
        </td>
        <td align="right" style="font-size:13px; color:#16a34a; font-weight:600; border-bottom:1px solid #e5e7eb; padding:6px;">
          $${Number(payment.amount).toFixed(2)}
        </td>
      </tr>
    `;
  }).join('');

  // Discount row (only if > 0)
  const discountHtml = invoice.discount_amount && Number(invoice.discount_amount) > 0 ? `
    <tr>
      <td style="font-size:14px; padding:4px 0;">Discount</td>
      <td align="right" style="font-size:14px; color:#16a34a; padding:4px 0;">
        -$${Number(invoice.discount_amount).toFixed(2)}
      </td>
    </tr>
  ` : '';

  // Tax row (only if > 0)
  const taxHtml = invoice.tax_amount && Number(invoice.tax_amount) > 0 ? `
    <tr>
      <td style="font-size:14px; padding:4px 0;">Tax (${invoice.tax_rate || 0}%)</td>
      <td align="right" style="font-size:14px; padding:4px 0;">
        $${Number(invoice.tax_amount).toFixed(2)}
      </td>
    </tr>
  ` : '';

  // Shipping row (only if > 0)
  const shippingHtml = invoice.shipping_amount && Number(invoice.shipping_amount) > 0 ? `
    <tr>
      <td style="font-size:14px; padding:4px 0;">Shipping</td>
      <td align="right" style="font-size:14px; padding:4px 0;">
        $${Number(invoice.shipping_amount).toFixed(2)}
      </td>
    </tr>
  ` : '';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Invoice Receipt</title>
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
              <p style="margin:0; font-size:16px; color:#22c55e; font-weight:600;">
                ✓ Payment Receipt${isResend ? ' (Copy)' : ''}
              </p>
            </td>
          </tr>

          <!-- Thank You Message -->
          <tr>
            <td style="padding:24px 20px 16px;">
              <h1 style="margin:0 0 8px 0; font-size:22px; color:#111827;">Thank you for your payment!</h1>
              <p style="margin:0; font-size:14px; color:#6b7280;">
                This receipt confirms your payment for Invoice <strong>${invoice.invoice_number}</strong>.
              </p>
            </td>
          </tr>

          <!-- Invoice & Merchant Info -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td valign="top" width="50%" style="padding-right:10px;">
                    <p style="margin:0 0 4px 0; font-size:12px; color:#6b7280; text-transform:uppercase;">From</p>
                    <p style="margin:0; font-size:14px; font-weight:600; color:#111827;">${merchant.business_name}</p>
                    ${merchant.address ? `<p style="margin:4px 0 0 0; font-size:13px; color:#6b7280;">${merchant.address}</p>` : ''}
                    ${merchant.phone ? `<p style="margin:2px 0 0 0; font-size:13px; color:#6b7280;">${merchant.phone}</p>` : ''}
                  </td>
                  <td valign="top" width="50%" style="padding-left:10px; text-align:right;">
                    <p style="margin:0 0 4px 0; font-size:12px; color:#6b7280; text-transform:uppercase;">Invoice Details</p>
                    <p style="margin:0; font-size:13px; color:#374151;"><strong>Invoice #:</strong> ${invoice.invoice_number}</p>
                    <p style="margin:4px 0 0 0; font-size:13px; color:#374151;"><strong>Issue Date:</strong> ${formattedIssueDate}</p>
                    <p style="margin:4px 0 0 0; font-size:13px; color:#374151;"><strong>Paid:</strong> ${formattedPaidDate}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bill To -->
          <tr>
            <td style="padding:0 20px 20px;">
              <p style="margin:0 0 4px 0; font-size:12px; color:#6b7280; text-transform:uppercase;">Bill To</p>
              <p style="margin:0; font-size:14px; font-weight:600; color:#111827;">${invoice.client_name}</p>
              ${invoice.client_company ? `<p style="margin:2px 0 0 0; font-size:13px; color:#6b7280;">${invoice.client_company}</p>` : ''}
              <p style="margin:2px 0 0 0; font-size:13px; color:#6b7280;">${invoice.client_email}</p>
            </td>
          </tr>

          <!-- Line Items -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table width="100%" cellpadding="8" cellspacing="0" style="border-collapse:collapse;">
                <tr style="background-color:#f3f4f6;">
                  <th align="left" style="font-size:12px; color:#111827; border-bottom:1px solid #e5e7eb; padding:8px; text-transform:uppercase;">
                    Description
                  </th>
                  <th align="center" style="font-size:12px; color:#111827; border-bottom:1px solid #e5e7eb; padding:8px; text-transform:uppercase;">
                    Qty
                  </th>
                  <th align="right" style="font-size:12px; color:#111827; border-bottom:1px solid #e5e7eb; padding:8px; text-transform:uppercase;">
                    Rate
                  </th>
                  <th align="right" style="font-size:12px; color:#111827; border-bottom:1px solid #e5e7eb; padding:8px; text-transform:uppercase;">
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
              <table width="280" cellpadding="0" cellspacing="0" style="margin-left:auto;">
                <tr>
                  <td style="font-size:14px; padding:4px 0;">Subtotal</td>
                  <td align="right" style="font-size:14px; padding:4px 0;">$${Number(invoice.subtotal).toFixed(2)}</td>
                </tr>
                ${discountHtml}
                ${taxHtml}
                ${shippingHtml}
                <tr>
                  <td colspan="2" style="border-top:1px solid #e5e7eb; padding-top:8px;"></td>
                </tr>
                <tr>
                  <td style="font-size:16px; font-weight:bold; padding:4px 0;">Total</td>
                  <td align="right" style="font-size:16px; font-weight:bold; padding:4px 0;">$${Number(invoice.total).toFixed(2)}</td>
                </tr>
                <tr>
                  <td style="font-size:14px; color:#16a34a; padding:4px 0;">Amount Paid</td>
                  <td align="right" style="font-size:14px; color:#16a34a; font-weight:600; padding:4px 0;">$${Number(invoice.amount_paid).toFixed(2)}</td>
                </tr>
                ${Number(invoice.amount_due) > 0 ? `
                <tr>
                  <td style="font-size:14px; color:#f59e0b; padding:4px 0;">Balance Due</td>
                  <td align="right" style="font-size:14px; color:#f59e0b; font-weight:600; padding:4px 0;">$${Number(invoice.amount_due).toFixed(2)}</td>
                </tr>
                ` : ''}
              </table>
            </td>
          </tr>

          <!-- Payment History -->
          ${payments.length > 0 ? `
          <tr>
            <td style="padding:0 20px 20px;">
              <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280; text-transform:uppercase; font-weight:600;">Payment History</p>
              <table width="100%" cellpadding="6" cellspacing="0" style="border-collapse:collapse; border:1px solid #e5e7eb; border-radius:6px;">
                <tr style="background-color:#f9fafb;">
                  <th align="left" style="font-size:11px; color:#6b7280; padding:6px; text-transform:uppercase;">Date</th>
                  <th align="left" style="font-size:11px; color:#6b7280; padding:6px; text-transform:uppercase;">Method</th>
                  <th align="left" style="font-size:11px; color:#6b7280; padding:6px; text-transform:uppercase;">Reference</th>
                  <th align="right" style="font-size:11px; color:#6b7280; padding:6px; text-transform:uppercase;">Amount</th>
                </tr>
                ${paymentsHtml}
              </table>
            </td>
          </tr>
          ` : ''}

          <!-- Status Banner -->
          <tr>
            <td style="padding:0 20px 20px;">
              <table width="100%" cellpadding="16" cellspacing="0" style="background: linear-gradient(135deg, #dcfce7 0%, #bbf7d0 100%); border-radius:8px;">
                <tr>
                  <td align="center">
                    <p style="margin:0; font-size:20px; font-weight:bold; color:#166534;">
                      ${Number(invoice.amount_due) > 0 ? '⚡ Partial Payment Received' : '✓ Paid in Full'}
                    </p>
                    <p style="margin:8px 0 0 0; font-size:13px; color:#15803d;">
                      ${Number(invoice.amount_due) > 0 
                        ? `Balance remaining: $${Number(invoice.amount_due).toFixed(2)}`
                        : 'Thank you for your business!'}
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- CTA Button -->
          <tr>
            <td style="padding:0 20px 20px; text-align:center;">
              <a href="https://pawbucks.app/dashboard" style="display:inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color:white; text-decoration:none; padding:14px 32px; border-radius:8px; font-weight:600; font-size:16px;">
                View Your Dashboard
              </a>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:20px; background-color:#f9fafb; text-align:center;">
              <p style="margin:0 0 8px 0; font-size:12px; color:#6b7280;">
                Questions? Contact ${merchant.business_name} or support@pawbucks.app
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
    // Authentication: accept either an internal-secret call (server-to-server)
    // or an authenticated merchant who owns the invoice (frontend resends).
    const internalSecret = Deno.env.get('INTERNAL_TRIGGER_SECRET');
    const providedSecret = req.headers.get('x-internal-secret');
    const isInternal = !!internalSecret && providedSecret === internalSecret;

    const authHeader = req.headers.get('Authorization');
    let authenticatedUserId: string | null = null;
    if (!isInternal) {
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const token = authHeader.replace('Bearer ', '');
      const authClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        { auth: { persistSession: false } }
      );
      const { data: claimsData, error: claimsErr } = await authClient.auth.getClaims(token);
      if (claimsErr || !claimsData?.claims?.sub) {
        return new Response(JSON.stringify({ error: 'unauthorized' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      authenticatedUserId = claimsData.claims.sub as string;
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[INVOICE_RECEIPT] RESEND_API_KEY not configured, skipping receipt email");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { invoiceId, paymentId, isResend = false }: InvoiceReceiptRequest = await req.json();

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    console.log('[INVOICE_RECEIPT] Fetching invoice:', invoiceId);

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // If authenticated (non-internal), verify the caller owns the invoice's merchant
    if (!isInternal && authenticatedUserId) {
      const { data: ownedMerchant } = await supabase
        .from("merchants")
        .select("id")
        .eq("id", invoice.merchant_id)
        .eq("user_id", authenticatedUserId)
        .maybeSingle();
      if (!ownedMerchant) {
        return new Response(JSON.stringify({ error: 'forbidden' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Fetch invoice items
    const { data: items, error: itemsError } = await supabase
      .from("invoice_items")
      .select("*")
      .eq("invoice_id", invoiceId)
      .order("sort_order");

    if (itemsError) {
      throw new Error("Failed to fetch invoice items");
    }

    // Fetch payments
    const { data: payments, error: paymentsError } = await supabase
      .from("invoice_payments")
      .select("*")
      .eq("invoice_id", invoiceId)
      .eq("status", "completed")
      .order("payment_date", { ascending: false });

    if (paymentsError) {
      console.error('[INVOICE_RECEIPT] Error fetching payments:', paymentsError);
    }

    // Fetch merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("business_name, address, phone, email, logo_url")
      .eq("id", invoice.merchant_id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    console.log('[INVOICE_RECEIPT] Sending receipt email to:', invoice.client_email);

    const resend = new Resend(resendApiKey);
    const html = generateReceiptHtml({
      invoice,
      items: items || [],
      payments: payments || [],
      merchant,
      isResend
    });

    const subjectPrefix = isResend ? '[Copy] ' : '';
    const { data, error } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [invoice.client_email],
      subject: `${subjectPrefix}Receipt - ${invoice.invoice_number} - ${merchant.business_name}`,
      html,
    });

    if (error) {
      console.error('[INVOICE_RECEIPT] Failed to send receipt email:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Log activity
    await supabase.from("invoice_activity").insert({
      invoice_id: invoiceId,
      action: isResend ? "receipt_resent" : "receipt_sent",
      description: `Receipt email ${isResend ? 'resent' : 'sent'} to ${invoice.client_email}`,
    });

    console.log('[INVOICE_RECEIPT] ✅ Receipt email sent successfully:', data);
    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[INVOICE_RECEIPT] Error sending receipt email:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
