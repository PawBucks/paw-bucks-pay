import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function formatDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  return `${months[month - 1]} ${day}, ${year}`;
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

    // Verify admin auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    // Check admin role
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    
    const isAdmin = roles?.some((r: any) => r.role === "admin" || r.role === "superadmin");
    if (!isAdmin) throw new Error("Unauthorized - admin access required");

    const { invoiceId } = await req.json();
    if (!invoiceId) throw new Error("Invoice ID is required");

    // Fetch invoice with items
    const { data: invoice, error: invError } = await supabase
      .from("admin_invoices")
      .select("*, admin_invoice_items(*)")
      .eq("id", invoiceId)
      .single();

    if (invError || !invoice) throw new Error("Invoice not found");
    if (!invoice.recipient_email) throw new Error("Recipient has no email address on file");

    const items = invoice.admin_invoice_items || [];
    const itemsHtml = items
      .sort((a: any, b: any) => a.display_order - b.display_order)
      .map((item: any) => `
        <tr>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; font-size: 14px; color: #374151;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: center; font-size: 14px; color: #374151;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px; color: #374151;">$${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #e5e7eb; text-align: right; font-size: 14px; color: #374151;">$${Number(item.amount).toFixed(2)}</td>
        </tr>
      `).join("");

    const logoUrl = "https://pawbucks.app/logo.png";
    const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "https://pawbucks.app";
    const paymentUrl = `${appUrl}/admin-invoice/${invoiceId}/pay?token=${invoice.access_token}`;
    const amountDue = Number(invoice.amount_due ?? invoice.total);
    const isPaid = invoice.status === "paid" || amountDue <= 0;

    const emailHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number} from PawBucks</title>
</head>
<body style="margin: 0; padding: 0; font-family: Arial, Helvetica, sans-serif; background-color: #f5f7fa;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f7fa; padding: 20px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 10px; overflow: hidden;">

          <!-- Header with Logo -->
          <tr>
            <td style="padding: 24px; text-align: center; background-color: #ffffff; border-bottom: 1px solid #e5e7eb;">
              <img 
                src="${logoUrl}" 
                alt="PawBucks" 
                width="120"
                style="display: block; margin: 0 auto; max-width: 120px;"
              />
            </td>
          </tr>

          <!-- Invoice Title -->
          <tr>
            <td style="padding: 30px 30px 10px; text-align: center;">
              <p style="margin: 0 0 4px; font-size: 13px; color: #6b7280; text-transform: uppercase; letter-spacing: 1px;">Platform Invoice</p>
              <h1 style="margin: 0; font-size: 22px; color: #111827; font-weight: 700;">${invoice.invoice_number}</h1>
              ${invoice.title ? `<p style="margin: 8px 0 0; font-size: 15px; color: #6b7280;">${invoice.title}</p>` : ""}
            </td>
          </tr>

          <!-- Dates -->
          <tr>
            <td style="padding: 20px 30px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Issue Date</p>
                    <p style="margin: 4px 0 0; font-weight: 600; font-size: 14px; color: #111827;">${formatDateOnly(invoice.issue_date)}</p>
                  </td>
                  <td align="right" style="padding: 14px 16px;">
                    <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Due Date</p>
                    <p style="margin: 4px 0 0; font-weight: 600; font-size: 14px; color: #111827;">${formatDateOnly(invoice.due_date)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Bill To -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Bill To</p>
              <p style="margin: 4px 0 0; font-weight: 600; font-size: 14px; color: #111827;">${invoice.recipient_name}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280; text-transform: capitalize;">${invoice.recipient_type}</p>
              <p style="margin: 2px 0 0; font-size: 13px; color: #6b7280;">${invoice.recipient_email}</p>
            </td>
          </tr>

          ${invoice.description ? `
          <tr>
            <td style="padding: 0 30px 20px;">
              <p style="margin: 0; font-size: 11px; color: #9ca3af; text-transform: uppercase;">Description</p>
              <p style="margin: 4px 0 0; font-size: 14px; color: #374151;">${invoice.description}</p>
            </td>
          </tr>
          ` : ""}

          <!-- Items -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse;">
                <thead>
                  <tr style="background: #f9fafb;">
                    <th style="padding: 10px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Description</th>
                    <th style="padding: 10px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Qty</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Rate</th>
                    <th style="padding: 10px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #6b7280; font-weight: 600;">Amount</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
              </table>
            </td>
          </tr>

          <!-- Totals -->
          <tr>
            <td style="padding: 0 30px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border-top: 2px solid #e5e7eb;">
                <tr>
                  <td style="padding: 8px 0; font-size: 14px; color: #6b7280;">Subtotal</td>
                  <td align="right" style="padding: 8px 0; font-size: 14px; color: #374151;">$${Number(invoice.subtotal).toFixed(2)}</td>
                </tr>
                ${Number(invoice.discount_amount) > 0 ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #16a34a;">Discount</td>
                  <td align="right" style="padding: 4px 0; font-size: 14px; color: #16a34a;">-$${Number(invoice.discount_amount).toFixed(2)}</td>
                </tr>
                ` : ""}
                ${Number(invoice.tax_amount) > 0 ? `
                <tr>
                  <td style="padding: 4px 0; font-size: 14px; color: #6b7280;">Tax${invoice.tax_rate ? ` (${invoice.tax_rate}%)` : ""}</td>
                  <td align="right" style="padding: 4px 0; font-size: 14px; color: #374151;">$${Number(invoice.tax_amount).toFixed(2)}</td>
                </tr>
                ` : ""}
                <tr>
                  <td style="padding: 14px 0 4px; font-size: 20px; font-weight: 700; color: #111827; border-top: 1px solid #e5e7eb;">Amount Due</td>
                  <td align="right" style="padding: 14px 0 4px; font-size: 20px; font-weight: 700; color: #2a9d8f; border-top: 1px solid #e5e7eb;">$${amountDue.toFixed(2)}</td>
                </tr>
              </table>
            </td>
          </tr>

          ${!isPaid ? `
          <!-- Pay Now Button -->
          <tr>
            <td style="padding: 0 30px 30px; text-align: center;">
              <a href="${paymentUrl}" 
                style="display: inline-block; padding: 14px 48px; background-color: #2a9d8f; color: #ffffff; font-size: 16px; font-weight: 700; text-decoration: none; border-radius: 8px; letter-spacing: 0.5px;">
                Pay Invoice
              </a>
              <p style="margin: 10px 0 0; font-size: 12px; color: #9ca3af;">Click above to pay securely online</p>
            </td>
          </tr>
          ` : ""}

          ${invoice.notes ? `
          <tr>
            <td style="padding: 0 30px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #374151;">Notes</p>
                    <p style="margin: 0; font-size: 13px; color: #6b7280; white-space: pre-wrap;">${invoice.notes}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          ${invoice.terms_conditions ? `
          <tr>
            <td style="padding: 0 30px 20px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="background: #f9fafb; border-radius: 8px;">
                <tr>
                  <td style="padding: 14px 16px;">
                    <p style="margin: 0 0 4px; font-weight: 600; font-size: 13px; color: #374151;">Terms & Conditions</p>
                    <p style="margin: 0; font-size: 13px; color: #6b7280; white-space: pre-wrap;">${invoice.terms_conditions}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          ` : ""}

          <!-- Footer -->
          <tr>
            <td style="background: #f9fafb; padding: 20px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #9ca3af; font-size: 12px;">
                If you have questions about this invoice, please contact the PawBucks team.
              </p>
              <p style="margin: 10px 0 0; color: #9ca3af; font-size: 11px;">
                Powered by PawBucks
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

    // Send via Resend
    if (!RESEND_API_KEY) {
      throw new Error("Email service not configured");
    }

    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `PawBucks <noreply@pawbucks.app>`,
        to: [invoice.recipient_email],
        subject: `Invoice ${invoice.invoice_number} from PawBucks`,
        html: emailHtml,
      }),
    });

    if (!emailResponse.ok) {
      const errorText = await emailResponse.text();
      console.error("Resend error:", errorText);
      throw new Error("Failed to send email");
    }

    console.log(`Admin invoice ${invoice.invoice_number} sent to ${invoice.recipient_email}`);

    // Update status to sent
    await supabase
      .from("admin_invoices")
      .update({ status: invoice.status === "draft" ? "sent" : invoice.status })
      .eq("id", invoiceId);

    return new Response(
      JSON.stringify({ success: true, message: "Invoice sent successfully" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error sending admin invoice:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
