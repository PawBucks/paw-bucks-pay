import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
          <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.description}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unit_price).toFixed(2)}</td>
          <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.amount).toFixed(2)}</td>
        </tr>
      `).join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice ${invoice.invoice_number} from PawBucks</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #2a9d8f 0%, #1a7a6e 100%); padding: 30px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px;">PawBucks</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 8px 0 0; font-size: 14px;">Platform Invoice</p>
      </div>

      <!-- Invoice Info -->
      <div style="padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0 0 5px; color: #333;">Invoice ${invoice.invoice_number}</h2>
          ${invoice.title ? `<p style="margin: 0; color: #666;">${invoice.title}</p>` : ""}
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 25px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <div>
            <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Issue Date</p>
            <p style="margin: 5px 0 0; font-weight: 600;">${formatDateOnly(invoice.issue_date)}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Due Date</p>
            <p style="margin: 5px 0 0; font-weight: 600;">${formatDateOnly(invoice.due_date)}</p>
          </div>
        </div>

        <!-- Bill To -->
        <div style="margin-bottom: 25px;">
          <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Bill To</p>
          <p style="margin: 5px 0 0; font-weight: 600;">${invoice.recipient_name}</p>
          <p style="margin: 2px 0 0; color: #666; text-transform: capitalize;">${invoice.recipient_type}</p>
          <p style="margin: 2px 0 0; color: #666;">${invoice.recipient_email}</p>
        </div>

        ${invoice.description ? `
        <div style="margin-bottom: 25px;">
          <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Description</p>
          <p style="margin: 5px 0 0; color: #333;">${invoice.description}</p>
        </div>
        ` : ""}

        <!-- Items -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Description</th>
              <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #666;">Qty</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #666;">Rate</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #666;">Amount</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <!-- Totals -->
        <div style="border-top: 2px solid #eee; padding-top: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #666;">Subtotal</span>
            <span>$${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          ${Number(invoice.discount_amount) > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;">
            <span>Discount</span>
            <span>-$${Number(invoice.discount_amount).toFixed(2)}</span>
          </div>
          ` : ""}
          ${Number(invoice.tax_amount) > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #666;">Tax${invoice.tax_rate ? ` (${invoice.tax_rate}%)` : ""}</span>
            <span>$${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700; padding-top: 10px; border-top: 1px solid #eee;">
            <span>Amount Due</span>
            <span style="color: #2a9d8f;">$${Number(invoice.amount_due ?? invoice.total).toFixed(2)}</span>
          </div>
        </div>

        ${invoice.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <p style="margin: 0 0 5px; font-weight: 600; font-size: 14px;">Notes</p>
          <p style="margin: 0; color: #666; font-size: 14px; white-space: pre-wrap;">${invoice.notes}</p>
        </div>
        ` : ""}

        ${invoice.terms_conditions ? `
        <div style="margin-top: 15px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <p style="margin: 0 0 5px; font-weight: 600; font-size: 14px;">Terms & Conditions</p>
          <p style="margin: 0; color: #666; font-size: 14px; white-space: pre-wrap;">${invoice.terms_conditions}</p>
        </div>
        ` : ""}
      </div>

      <!-- Footer -->
      <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          If you have questions about this invoice, please contact the PawBucks team.
        </p>
        <p style="margin: 10px 0 0; color: #999; font-size: 11px;">
          Powered by PawBucks
        </p>
      </div>
    </div>
  </div>
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
