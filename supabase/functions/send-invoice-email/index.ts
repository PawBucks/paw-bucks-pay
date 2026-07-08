import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { escapeHtml } from "../_shared/escape-html.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

// Format date-only strings (YYYY-MM-DD) without timezone shift
function formatLocalDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[month - 1]} ${day}, ${year}`;
}

// Get today's date string (YYYY-MM-DD) in America/New_York (EST/PST).
// Server runs in UTC, so we MUST normalize to Eastern Time before comparing
// calendar dates — otherwise an invoice "due today" in EST shows as past
// due once UTC rolls over at 7-8 PM Eastern.
function getEasternTodayString(): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(new Date()); // en-CA returns YYYY-MM-DD
}

// Strictly past due means due_date < today (Eastern). Due-today is NOT past due.
function isDatePastDue(dateString: string): boolean {
  return dateString < getEasternTodayString();
}

function isDateDueToday(dateString: string): boolean {
  return dateString === getEasternTodayString();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Verify user is authenticated
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("No authorization header");
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) {
      throw new Error("Unauthorized");
    }

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    // Fetch the invoice with merchant details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_items (*)
      `)
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // Fetch additional recipients
    const { data: recipientsData } = await supabase
      .from("invoice_recipients")
      .select("*")
      .eq("invoice_id", invoiceId);
    
    const additionalRecipients = recipientsData || [];

    // Verify user owns this merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", invoice.merchant_id)
      .eq("user_id", userData.user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Unauthorized - merchant not found");
    }

    // Build the payment URL
    const appUrl = Deno.env.get("APP_URL") || "https://pawbucks.app";
    const paymentUrl = `${appUrl}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;

    // Calculate totals for display
    const items = invoice.invoice_items || [];
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e6f5f3; color:#1a1a1a; font-size:14px;">${escapeHtml(item.description)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e6f5f3; text-align: center; color:#4a4a4a; font-size:14px;">${item.quantity}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e6f5f3; text-align: right; color:#4a4a4a; font-size:14px;">$${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 12px 8px; border-bottom: 1px solid #e6f5f3; text-align: right; color:#1a1a1a; font-size:14px; font-weight:600;">$${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
      </tr>
    `).join("");

    // Status badge
    const amountDueNum = Number(invoice.amount_due ?? invoice.total ?? 0);
    const isPaid = invoice.status === "paid" || amountDueNum <= 0;
    const pastDue = !isPaid && isDatePastDue(invoice.due_date);
    const dueToday = !isPaid && !pastDue && isDateDueToday(invoice.due_date);
    let badgeText = "Due " + formatLocalDateOnly(invoice.due_date);
    let badgeBg = "#e6f5f3"; let badgeColor = "#2E9E8F";
    if (isPaid) { badgeText = "✓ Paid"; badgeBg = "#dcfce7"; badgeColor = "#15803d"; }
    else if (pastDue) { badgeText = "⚠ Past Due"; badgeBg = "#fee2e2"; badgeColor = "#dc2626"; }
    else if (dueToday) { badgeText = "⏰ Due Today"; badgeBg = "#fef3c7"; badgeColor = "#b45309"; }

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice from ${escapeHtml(merchant.business_name)}</title>
</head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color:#f5f7f7; color:#1a1a1a;">
  <div style="max-width:600px; margin:0 auto; padding:20px;">
    <div style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(46,158,143,0.08);">
      <!-- Header -->
      <div style="background:linear-gradient(135deg, #2E9E8F 0%, #247d72 100%); padding:32px 24px; text-align:center;">
        ${merchant.logo_url
          ? `<img src="${encodeURI(merchant.logo_url)}" alt="${escapeHtml(merchant.business_name)}" style="height:64px; width:64px; border-radius:50%; background:#fff; padding:4px; margin-bottom:14px; object-fit:cover;">`
          : `<div style="height:64px; width:64px; line-height:64px; border-radius:50%; background:rgba(255,255,255,0.18); color:#fff; font-weight:800; font-size:22px; margin:0 auto 14px;">${escapeHtml((merchant.business_name || "?").slice(0,2).toUpperCase())}</div>`
        }
        <h1 style="color:#ffffff; margin:0; font-size:22px; font-weight:700;">${escapeHtml(merchant.business_name)}</h1>
        ${merchant.address ? `<p style="color:rgba(255,255,255,0.9); margin:6px 0 0; font-size:13px;">${escapeHtml(merchant.address)}</p>` : ""}
      </div>

      <!-- Invoice meta -->
      <div style="padding:28px 24px 8px; text-align:center;">
        <p style="margin:0; font-size:12px; letter-spacing:0.12em; color:#2E9E8F; text-transform:uppercase; font-weight:600;">Invoice</p>
        <h2 style="margin:6px 0 4px; color:#1a1a1a; font-size:24px; font-weight:700;">#${escapeHtml(invoice.invoice_number)}</h2>
        ${invoice.title ? `<p style="margin:0 0 12px; color:#6b7280; font-size:14px;">${escapeHtml(invoice.title)}</p>` : `<div style="height:8px;"></div>`}
        <span style="display:inline-block; background:${badgeBg}; color:${badgeColor}; font-weight:600; font-size:13px; padding:6px 14px; border-radius:999px;">${badgeText}</span>
      </div>

      <!-- Dates -->
      <div style="padding:20px 24px;">
        <table role="presentation" width="100%" style="background:#f7fbfa; border-radius:12px; padding:16px;">
          <tr>
            <td style="padding:12px 16px; vertical-align:top;">
              <p style="margin:0; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em;">Issue Date</p>
              <p style="margin:4px 0 0; font-weight:600; color:#1a1a1a; font-size:14px;">${formatLocalDateOnly(invoice.issue_date)}</p>
            </td>
            <td style="padding:12px 16px; vertical-align:top; text-align:right;">
              <p style="margin:0; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em;">Due Date</p>
              <p style="margin:4px 0 0; font-weight:600; color:${pastDue ? "#dc2626" : "#1a1a1a"}; font-size:14px;">${formatLocalDateOnly(invoice.due_date)}</p>
            </td>
          </tr>
        </table>
      </div>

      <!-- Bill To -->
      <div style="padding:0 24px 20px;">
        <p style="margin:0 0 8px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Bill To</p>
        <p style="margin:0; font-weight:600; color:#1a1a1a; font-size:15px;">${escapeHtml(invoice.client_name)}</p>
        ${invoice.client_company ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">${escapeHtml(invoice.client_company)}</p>` : ""}
        <p style="margin:2px 0 0; color:#6b7280; font-size:13px;">${escapeHtml(invoice.client_email)}</p>
        ${invoice.client_phone ? `<p style="margin:2px 0 0; color:#6b7280; font-size:13px;">${escapeHtml(invoice.client_phone)}</p>` : ""}
      </div>

      <!-- Items -->
      <div style="padding:0 24px;">
        <p style="margin:0 0 8px; font-size:11px; color:#6b7280; text-transform:uppercase; letter-spacing:0.08em; font-weight:600;">Items</p>
        <table style="width:100%; border-collapse:collapse;">
          <thead>
            <tr>
              <th style="padding:10px 8px; text-align:left; font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:2px solid #e6f5f3; letter-spacing:0.06em;">Description</th>
              <th style="padding:10px 8px; text-align:center; font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:2px solid #e6f5f3; letter-spacing:0.06em;">Qty</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:2px solid #e6f5f3; letter-spacing:0.06em;">Rate</th>
              <th style="padding:10px 8px; text-align:right; font-size:11px; text-transform:uppercase; color:#6b7280; border-bottom:2px solid #e6f5f3; letter-spacing:0.06em;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>
      </div>

      <!-- Totals -->
      <div style="padding:20px 24px;">
        <table role="presentation" width="100%" style="background:#f7fbfa; border-radius:12px;">
          <tr><td style="padding:12px 16px 6px; color:#6b7280; font-size:14px;">Subtotal</td>
              <td style="padding:12px 16px 6px; text-align:right; color:#1a1a1a; font-size:14px;">$${Number(invoice.subtotal).toFixed(2)}</td></tr>
          ${invoice.discount_amount && Number(invoice.discount_amount) > 0 ? `
          <tr><td style="padding:6px 16px; color:#15803d; font-size:14px;">Discount</td>
              <td style="padding:6px 16px; text-align:right; color:#15803d; font-size:14px;">-$${Number(invoice.discount_amount).toFixed(2)}</td></tr>` : ""}
          ${invoice.tax_amount && Number(invoice.tax_amount) > 0 ? `
          <tr><td style="padding:6px 16px; color:#6b7280; font-size:14px;">Tax ${invoice.tax_rate ? `(${invoice.tax_rate}%)` : ""}</td>
              <td style="padding:6px 16px; text-align:right; color:#1a1a1a; font-size:14px;">$${Number(invoice.tax_amount).toFixed(2)}</td></tr>` : ""}
          <tr><td colspan="2" style="padding:0 16px;"><div style="border-top:1px solid #e6f5f3;"></div></td></tr>
          <tr>
            <td style="padding:12px 16px 14px; font-weight:700; font-size:16px; color:#1a1a1a;">${isPaid ? "Total Paid" : "Amount Due"}</td>
            <td style="padding:12px 16px 14px; text-align:right; font-weight:800; font-size:22px; color:#2E9E8F;">$${amountDueNum.toFixed(2)}</td>
          </tr>
        </table>
      </div>

      ${!isPaid ? `
      <!-- Pay Button -->
      <div style="padding:8px 24px 28px; text-align:center;">
        <a href="${paymentUrl}" style="display:inline-block; background:linear-gradient(135deg, #2E9E8F 0%, #247d72 100%); color:#ffffff; text-decoration:none; padding:16px 44px; border-radius:12px; font-weight:700; font-size:16px; box-shadow:0 4px 14px rgba(46,158,143,0.35);">Pay Now →</a>
        <p style="margin:14px 0 0; color:#6b7280; font-size:12px;">Secure payment via pawbucks.app</p>
        <p style="margin:4px 0 0; color:#9ca3af; font-size:12px;">Pay with PawBucks, card, cash, Venmo or Zelle</p>
      </div>` : ""}

      ${invoice.notes ? `
      <div style="margin:0 24px 24px; padding:14px 16px; background:#f7fbfa; border-radius:12px;">
        <p style="margin:0 0 4px; font-weight:600; font-size:13px; color:#1a1a1a;">Notes</p>
        <p style="margin:0; color:#4a4a4a; font-size:13px; white-space:pre-wrap;">${escapeHtml(invoice.notes)}</p>
      </div>` : ""}

      <!-- Thank you -->
      <div style="padding:8px 24px 20px; text-align:center;">
        <p style="margin:0; color:#1a1a1a; font-size:14px; font-weight:600;">${escapeHtml(invoice.footer || "Thank you for your business! 🐾")}</p>
      </div>

      <!-- Footer / contact -->
      <div style="background:#f7fbfa; padding:22px 24px; text-align:center; border-top:1px solid #e6f5f3;">
        <p style="margin:0; color:#1a1a1a; font-size:13px; font-weight:600;">Questions about this invoice?</p>
        ${merchant.phone ? `<p style="margin:6px 0 0;"><a href="tel:${merchant.phone}" style="color:#2E9E8F; text-decoration:none; font-weight:600; font-size:14px;">${merchant.phone}</a></p>` : ""}
        ${merchant.email ? `<p style="margin:4px 0 0;"><a href="mailto:${merchant.email}" style="color:#2E9E8F; text-decoration:none; font-size:13px;">${merchant.email}</a></p>` : ""}
        <p style="margin:14px 0 0; color:#6b7280; font-size:12px;">${escapeHtml(merchant.business_name)} accepts PawBucks, Cash, Checks,<br>Credit Cards, Venmo and Zelle</p>
        <p style="margin:14px 0 0; color:#9ca3af; font-size:12px;">🐾 Powered by <a href="https://pawbucks.app" style="color:#2E9E8F; text-decoration:none; font-weight:600;">pawbucks.app</a></p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using Resend
    if (RESEND_API_KEY) {
      // Build recipient lists
      const toRecipients = [invoice.client_email];
      const ccRecipients = additionalRecipients
        .filter((r: any) => r.recipient_type === 'cc')
        .map((r: any) => r.email);
      const bccRecipients = additionalRecipients
        .filter((r: any) => r.recipient_type === 'bcc')
        .map((r: any) => r.email);
      
      const emailPayload: any = {
        from: `${merchant.business_name} <noreply@pawbucks.app>`,
        to: toRecipients,
        subject: `Invoice #${invoice.invoice_number} from ${merchant.business_name}`,
        html: emailHtml,
      };
      
      // Add CC recipients if any
      if (ccRecipients.length > 0) {
        emailPayload.cc = ccRecipients;
      }
      
      // Add BCC recipients if any
      if (bccRecipients.length > 0) {
        emailPayload.bcc = bccRecipients;
      }
      
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(emailPayload),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Resend error:", errorText);
        throw new Error("Failed to send email");
      }
      
      console.log(`Invoice sent to ${toRecipients.join(', ')}${ccRecipients.length > 0 ? `, CC: ${ccRecipients.join(', ')}` : ''}${bccRecipients.length > 0 ? `, BCC: ${bccRecipients.length} recipients` : ''}`);
    } else {
      console.log("RESEND_API_KEY not configured, skipping email send");
    }

    // Update invoice status and sent_at
    await supabase
      .from("invoices")
      .update({
        status: invoice.status === "draft" ? "sent" : invoice.status,
        sent_at: new Date().toISOString(),
      })
      .eq("id", invoiceId);

    // Log activity
    const allRecipients = [invoice.client_email, ...additionalRecipients.map((r: any) => r.email)];
    await supabase
      .from("invoice_activity")
      .insert({
        invoice_id: invoiceId,
        action: "sent",
        description: `Invoice sent to ${allRecipients.join(', ')}`,
        performed_by: userData.user.id,
      });

    return new Response(
      JSON.stringify({ success: true, message: "Invoice sent successfully" }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error sending invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
