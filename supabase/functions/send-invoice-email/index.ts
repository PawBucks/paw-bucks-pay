import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

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
    const appUrl = Deno.env.get("APP_URL") || "https://paw-bucks-pay.lovable.app";
    const paymentUrl = `${appUrl}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;

    // Calculate totals for display
    const items = invoice.invoice_items || [];
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
      </tr>
    `).join("");

    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice from ${merchant.business_name}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <div style="max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: white; border-radius: 12px; overflow: hidden; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center;">
        ${merchant.logo_url ? `<img src="${merchant.logo_url}" alt="${merchant.business_name}" style="height: 60px; margin-bottom: 15px;">` : ""}
        <h1 style="color: white; margin: 0; font-size: 24px;">${merchant.business_name}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">${merchant.address || ""}</p>
      </div>

      <!-- Invoice Info -->
      <div style="padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0 0 5px 0; color: #333;">Invoice #${invoice.invoice_number}</h2>
          ${invoice.title ? `<p style="margin: 0; color: #666;">${invoice.title}</p>` : ""}
        </div>

        <div style="display: flex; justify-content: space-between; margin-bottom: 25px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <div>
            <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Issue Date</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${new Date(invoice.issue_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Due Date</p>
            <p style="margin: 5px 0 0 0; font-weight: 600; color: ${new Date(invoice.due_date) < new Date() ? "#dc2626" : "#333"};">
              ${new Date(invoice.due_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </p>
          </div>
        </div>

        <!-- Bill To -->
        <div style="margin-bottom: 25px;">
          <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Bill To</p>
          <p style="margin: 5px 0 0 0; font-weight: 600;">${invoice.client_name}</p>
          ${invoice.client_company ? `<p style="margin: 2px 0 0 0; color: #666;">${invoice.client_company}</p>` : ""}
          <p style="margin: 2px 0 0 0; color: #666;">${invoice.client_email}</p>
          ${invoice.client_phone ? `<p style="margin: 2px 0 0 0; color: #666;">${invoice.client_phone}</p>` : ""}
        </div>

        <!-- Items Table -->
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 12px; text-align: left; font-size: 12px; text-transform: uppercase; color: #666;">Description</th>
              <th style="padding: 12px; text-align: center; font-size: 12px; text-transform: uppercase; color: #666;">Qty</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #666;">Rate</th>
              <th style="padding: 12px; text-align: right; font-size: 12px; text-transform: uppercase; color: #666;">Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <!-- Totals -->
        <div style="border-top: 2px solid #eee; padding-top: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #666;">Subtotal</span>
            <span>$${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          ${invoice.discount_amount && invoice.discount_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;">
            <span>Discount</span>
            <span>-$${Number(invoice.discount_amount).toFixed(2)}</span>
          </div>
          ` : ""}
          ${invoice.tax_amount && invoice.tax_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #666;">Tax ${invoice.tax_rate ? `(${invoice.tax_rate}%)` : ""}</span>
            <span>$${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>
          ` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700; padding-top: 10px; border-top: 1px solid #eee;">
            <span>Amount Due</span>
            <span style="color: #f97316;">$${Number(invoice.amount_due || invoice.total).toFixed(2)}</span>
          </div>
        </div>

        <!-- Pay Button -->
        <div style="text-align: center; margin-top: 30px;">
          <a href="${paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Pay Now
          </a>
        </div>

        ${invoice.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; font-size: 14px;">Notes</p>
          <p style="margin: 0; color: #666; font-size: 14px; white-space: pre-wrap;">${invoice.notes}</p>
        </div>
        ` : ""}
      </div>

      <!-- Footer -->
      <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #999; font-size: 12px;">
          ${invoice.footer || `Thank you for your business!`}
        </p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 11px;">
          Powered by PawBucks
        </p>
      </div>
    </div>
  </div>
</body>
</html>
    `;

    // Send email using Resend
    if (RESEND_API_KEY) {
      const emailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${merchant.business_name} <noreply@pawbucks.app>`,
          to: [invoice.client_email],
          subject: `Invoice #${invoice.invoice_number} from ${merchant.business_name}`,
          html: emailHtml,
        }),
      });

      if (!emailResponse.ok) {
        const errorText = await emailResponse.text();
        console.error("Resend error:", errorText);
        throw new Error("Failed to send email");
      }
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
    await supabase
      .from("invoice_activity")
      .insert({
        invoice_id: invoiceId,
        action: "sent",
        description: `Invoice sent to ${invoice.client_email}`,
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
