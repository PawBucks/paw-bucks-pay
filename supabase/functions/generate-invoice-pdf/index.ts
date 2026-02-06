import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Format date-only strings (YYYY-MM-DD) without timezone shift
function formatLocalDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
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

    const { invoiceId } = await req.json();

    if (!invoiceId) {
      throw new Error("Invoice ID is required");
    }

    // Fetch the invoice with items
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

    // Fetch the merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", invoice.merchant_id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    // Generate HTML for PDF
    const items = invoice.invoice_items || [];
    const itemsHtml = items.map((item: any) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.description}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unit_price).toFixed(2)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">$${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
      </tr>
    `).join("");

    const pdfHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Invoice #${invoice.invoice_number}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 0; padding: 40px; font-size: 12px; }
    .header { display: flex; justify-content: space-between; margin-bottom: 40px; }
    .logo { max-height: 60px; }
    .invoice-title { font-size: 28px; font-weight: bold; color: #f97316; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 30px; margin-bottom: 30px; }
    .info-section h3 { margin: 0 0 10px 0; color: #666; font-size: 11px; text-transform: uppercase; }
    .info-section p { margin: 3px 0; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
    th { background: #f5f5f5; padding: 10px 8px; text-align: left; font-size: 11px; text-transform: uppercase; color: #666; }
    .totals { width: 300px; margin-left: auto; }
    .totals-row { display: flex; justify-content: space-between; padding: 8px 0; }
    .totals-row.total { border-top: 2px solid #333; font-weight: bold; font-size: 16px; padding-top: 15px; }
    .notes { margin-top: 40px; padding: 20px; background: #f9f9f9; border-radius: 8px; }
    .footer { margin-top: 40px; text-align: center; color: #999; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      ${merchant.logo_url ? `<img src="${merchant.logo_url}" class="logo" alt="${merchant.business_name}">` : ""}
      <h1 style="margin: 10px 0 5px 0;">${merchant.business_name}</h1>
      <p style="margin: 0; color: #666;">${merchant.address || ""}</p>
      ${merchant.phone ? `<p style="margin: 0; color: #666;">${merchant.phone}</p>` : ""}
    </div>
    <div style="text-align: right;">
      <div class="invoice-title">INVOICE</div>
      <p style="margin: 5px 0;"><strong>#${invoice.invoice_number}</strong></p>
      ${invoice.title ? `<p style="margin: 0; color: #666;">${invoice.title}</p>` : ""}
    </div>
  </div>

  <div class="info-grid">
    <div class="info-section">
      <h3>Bill To</h3>
      <p><strong>${invoice.client_name}</strong></p>
      ${invoice.client_company ? `<p>${invoice.client_company}</p>` : ""}
      <p>${invoice.client_email}</p>
      ${invoice.client_phone ? `<p>${invoice.client_phone}</p>` : ""}
      ${invoice.client_address ? `<p>${invoice.client_address}</p>` : ""}
    </div>
    <div class="info-section" style="text-align: right;">
      <h3>Invoice Details</h3>
      <p><strong>Issue Date:</strong> ${formatLocalDateOnly(invoice.issue_date)}</p>
      <p><strong>Due Date:</strong> ${formatLocalDateOnly(invoice.due_date)}</p>
      <p><strong>Status:</strong> ${invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}</p>
    </div>
  </div>

  <table>
    <thead>
      <tr>
        <th style="width: 50%;">Description</th>
        <th style="width: 15%; text-align: center;">Qty</th>
        <th style="width: 15%; text-align: right;">Rate</th>
        <th style="width: 20%; text-align: right;">Amount</th>
      </tr>
    </thead>
    <tbody>
      ${itemsHtml}
    </tbody>
  </table>

  <div class="totals">
    <div class="totals-row">
      <span>Subtotal</span>
      <span>$${Number(invoice.subtotal).toFixed(2)}</span>
    </div>
    ${invoice.discount_amount && invoice.discount_amount > 0 ? `
    <div class="totals-row" style="color: #16a34a;">
      <span>Discount</span>
      <span>-$${Number(invoice.discount_amount).toFixed(2)}</span>
    </div>
    ` : ""}
    ${invoice.tax_amount && invoice.tax_amount > 0 ? `
    <div class="totals-row">
      <span>Tax ${invoice.tax_rate ? `(${invoice.tax_rate}%)` : ""}</span>
      <span>$${Number(invoice.tax_amount).toFixed(2)}</span>
    </div>
    ` : ""}
    ${invoice.shipping_amount && invoice.shipping_amount > 0 ? `
    <div class="totals-row">
      <span>Shipping</span>
      <span>$${Number(invoice.shipping_amount).toFixed(2)}</span>
    </div>
    ` : ""}
    <div class="totals-row total">
      <span>Total Due</span>
      <span style="color: #f97316;">$${Number(invoice.amount_due || invoice.total).toFixed(2)}</span>
    </div>
  </div>

  ${invoice.notes ? `
  <div class="notes">
    <h3 style="margin: 0 0 10px 0; font-size: 12px;">Notes</h3>
    <p style="margin: 0; white-space: pre-wrap;">${invoice.notes}</p>
  </div>
  ` : ""}

  ${invoice.terms_conditions ? `
  <div class="notes" style="background: #fff; border: 1px solid #eee;">
    <h3 style="margin: 0 0 10px 0; font-size: 12px;">Terms & Conditions</h3>
    <p style="margin: 0; white-space: pre-wrap;">${invoice.terms_conditions}</p>
  </div>
  ` : ""}

  <div class="footer">
    ${invoice.footer || "Thank you for your business!"}
  </div>
</body>
</html>
    `;

    // For now, we'll return the HTML that can be printed as PDF
    // A proper PDF generation would require a service like Puppeteer or a PDF API
    return new Response(
      JSON.stringify({
        success: true,
        html: pdfHtml,
        // In production, you would generate an actual PDF and return a URL
        message: "PDF generation ready - use browser print to save as PDF",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error generating PDF:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
