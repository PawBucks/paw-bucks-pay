import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays, addWeeks, addMonths, addYears, format } from "https://esm.sh/date-fns@3.6.0";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function formatLocalDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[month - 1]} ${day}, ${year}`;
}

// Compare against today in America/New_York so EST/PST users don't see
// "due today" invoices flipped to past-due once UTC rolls over.
function isDatePastDue(dateString: string): boolean {
  const easternToday = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return dateString < easternToday;
}

function buildInvoiceEmailHtml(invoice: any, merchant: any, items: any[], paymentUrl: string): string {
  const itemsHtml = items.map((item: any) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.description}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${Number(item.unit_price).toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(Number(item.quantity) * Number(item.unit_price)).toFixed(2)}</td>
    </tr>
  `).join("");

  return `
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
      <div style="background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); padding: 30px; text-align: center;">
        ${merchant.logo_url ? `<img src="${merchant.logo_url}" alt="${merchant.business_name}" style="height: 60px; margin-bottom: 15px;">` : ""}
        <h1 style="color: white; margin: 0; font-size: 24px;">${merchant.business_name}</h1>
        <p style="color: rgba(255,255,255,0.9); margin: 5px 0 0 0; font-size: 14px;">${merchant.address || ""}</p>
      </div>
      <div style="padding: 30px;">
        <div style="text-align: center; margin-bottom: 30px;">
          <h2 style="margin: 0 0 5px 0; color: #333;">Invoice #${invoice.invoice_number}</h2>
          ${invoice.title ? `<p style="margin: 0; color: #666;">${invoice.title}</p>` : ""}
        </div>
        <div style="display: flex; justify-content: space-between; margin-bottom: 25px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <div>
            <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Issue Date</p>
            <p style="margin: 5px 0 0 0; font-weight: 600;">${formatLocalDateOnly(invoice.issue_date)}</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Due Date</p>
            <p style="margin: 5px 0 0 0; font-weight: 600; color: ${isDatePastDue(invoice.due_date) ? "#dc2626" : "#333"};">
              ${formatLocalDateOnly(invoice.due_date)}
            </p>
          </div>
        </div>
        <div style="margin-bottom: 25px;">
          <p style="margin: 0; font-size: 12px; color: #999; text-transform: uppercase;">Bill To</p>
          <p style="margin: 5px 0 0 0; font-weight: 600;">${invoice.client_name}</p>
          ${invoice.client_company ? `<p style="margin: 2px 0 0 0; color: #666;">${invoice.client_company}</p>` : ""}
          <p style="margin: 2px 0 0 0; color: #666;">${invoice.client_email}</p>
          ${invoice.client_phone ? `<p style="margin: 2px 0 0 0; color: #666;">${invoice.client_phone}</p>` : ""}
        </div>
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
        <div style="border-top: 2px solid #eee; padding-top: 15px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #666;">Subtotal</span>
            <span>$${Number(invoice.subtotal).toFixed(2)}</span>
          </div>
          ${invoice.discount_amount && invoice.discount_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px; color: #16a34a;">
            <span>Discount</span>
            <span>-$${Number(invoice.discount_amount).toFixed(2)}</span>
          </div>` : ""}
          ${invoice.tax_amount && invoice.tax_amount > 0 ? `
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span style="color: #666;">Tax ${invoice.tax_rate ? `(${invoice.tax_rate}%)` : ""}</span>
            <span>$${Number(invoice.tax_amount).toFixed(2)}</span>
          </div>` : ""}
          <div style="display: flex; justify-content: space-between; font-size: 20px; font-weight: 700; padding-top: 10px; border-top: 1px solid #eee;">
            <span>Amount Due</span>
            <span style="color: #f97316;">$${Number(invoice.total).toFixed(2)}</span>
          </div>
        </div>
        <div style="text-align: center; margin-top: 30px;">
          <a href="${paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #f97316 0%, #ea580c 100%); color: white; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-weight: 600; font-size: 16px;">
            Pay Now
          </a>
        </div>
        ${invoice.notes ? `
        <div style="margin-top: 30px; padding: 15px; background: #f9f9f9; border-radius: 8px;">
          <p style="margin: 0 0 5px 0; font-weight: 600; font-size: 14px;">Notes</p>
          <p style="margin: 0; color: #666; font-size: 14px; white-space: pre-wrap;">${invoice.notes}</p>
        </div>` : ""}
      </div>
      <div style="background: #f9f9f9; padding: 20px; text-align: center; border-top: 1px solid #eee;">
        <p style="margin: 0; color: #999; font-size: 12px;">${invoice.footer || "Thank you for your business!"}</p>
        <p style="margin: 10px 0 0 0; color: #999; font-size: 11px;">Powered by PawBucks</p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

async function sendInvoiceEmail(invoice: any, merchant: any, items: any[]): Promise<boolean> {
  if (!RESEND_API_KEY || !invoice.client_email) {
    console.log(`Skipping email for ${invoice.invoice_number}: ${!RESEND_API_KEY ? 'no API key' : 'no client email'}`);
    return false;
  }

  const appUrl = Deno.env.get("APP_URL") || "https://pawbucks.app";
  const paymentUrl = `${appUrl}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;
  const emailHtml = buildInvoiceEmailHtml(invoice, merchant, items, paymentUrl);

  try {
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
      console.error(`Resend error for ${invoice.invoice_number}:`, errorText);
      return false;
    }

    console.log(`Email sent for invoice ${invoice.invoice_number} to ${invoice.client_email}`);
    return true;
  } catch (err) {
    console.error(`Failed to send email for ${invoice.invoice_number}:`, err);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }
);
  }

  const _authResp = checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    console.log("Starting recurring invoice generation...");
    const today = format(new Date(), "yyyy-MM-dd");

    // Find all recurring invoices that are due to generate a new invoice today
    const { data: recurringInvoices, error: fetchError } = await supabase
      .from("invoices")
      .select(`
        *,
        invoice_items:invoice_items(*)
      `)
      .eq("is_recurring", true)
      .eq("next_invoice_date", today)
      .or("recurring_end_date.is.null,recurring_end_date.gte." + today)
      .in("status", ["sent", "paid", "partial"]);

    if (fetchError) {
      console.error("Error fetching recurring invoices:", fetchError);
      throw fetchError;
    }

    console.log(`Found ${recurringInvoices?.length || 0} recurring invoices to process`);

    const results = [];

    for (const parentInvoice of recurringInvoices || []) {
      try {
        console.log(`Processing recurring invoice: ${parentInvoice.invoice_number}`);

        // Fetch merchant details for email branding
        const { data: merchant, error: merchantError } = await supabase
          .from("merchants")
          .select("*")
          .eq("id", parentInvoice.merchant_id)
          .single();

        if (merchantError || !merchant) {
          console.error(`Merchant not found for invoice ${parentInvoice.invoice_number}`);
          results.push({ parentId: parentInvoice.id, success: false, error: "Merchant not found" });
          continue;
        }

        // Get the next invoice number for this merchant
        const { data: settings } = await supabase
          .from("invoice_settings")
          .select("invoice_prefix, next_invoice_number")
          .eq("merchant_id", parentInvoice.merchant_id)
          .single();

        let invoiceNumber = "";
        if (settings) {
          invoiceNumber = `${settings.invoice_prefix || "INV-"}${String(settings.next_invoice_number || 1).padStart(4, "0")}`;
          await supabase
            .from("invoice_settings")
            .update({ next_invoice_number: (settings.next_invoice_number || 1) + 1 })
            .eq("merchant_id", parentInvoice.merchant_id);
        } else {
          invoiceNumber = `INV-${Date.now()}`;
        }

        // Calculate new dates
        const issueDate = new Date();
        const paymentTerms = parentInvoice.payment_terms ?? 30;
        const dueDate = addDays(issueDate, paymentTerms);
        const nextInvoiceDate = calculateNextDate(issueDate, parentInvoice.recurring_interval);
        const accessToken = crypto.randomUUID();

        // Create the new invoice as "sent" (not draft)
        const { data: newInvoice, error: createError } = await supabase
          .from("invoices")
          .insert({
            merchant_id: parentInvoice.merchant_id,
            client_id: parentInvoice.client_id,
            invoice_number: invoiceNumber,
            status: "sent",
            issue_date: format(issueDate, "yyyy-MM-dd"),
            due_date: format(dueDate, "yyyy-MM-dd"),
            sent_at: new Date().toISOString(),
            client_name: parentInvoice.client_name,
            client_email: parentInvoice.client_email,
            client_phone: parentInvoice.client_phone,
            client_company: parentInvoice.client_company,
            client_address: parentInvoice.client_address,
            subtotal: parentInvoice.subtotal,
            discount_type: parentInvoice.discount_type,
            discount_value: parentInvoice.discount_value,
            discount_amount: parentInvoice.discount_amount,
            tax_rate: parentInvoice.tax_rate,
            tax_amount: parentInvoice.tax_amount,
            shipping_amount: parentInvoice.shipping_amount,
            total: parentInvoice.total,
            amount_paid: 0,
            currency: parentInvoice.currency,
            title: parentInvoice.title,
            notes: parentInvoice.notes,
            footer: parentInvoice.footer,
            terms_conditions: parentInvoice.terms_conditions,
            payment_terms: parentInvoice.payment_terms,
            allow_partial_payments: parentInvoice.allow_partial_payments,
            allow_tips: parentInvoice.allow_tips,
            accept_credit_card: parentInvoice.accept_credit_card,
            accept_bank_transfer: parentInvoice.accept_bank_transfer,
            accept_pawbucks: parentInvoice.accept_pawbucks,
            access_token: accessToken,
            is_recurring: false,
            parent_invoice_id: parentInvoice.id,
          })
          .select()
          .single();

        if (createError) {
          console.error(`Error creating invoice from ${parentInvoice.invoice_number}:`, createError);
          results.push({ parentId: parentInvoice.id, success: false, error: createError.message });
          continue;
        }

        // Copy line items to new invoice
        const copiedItems: any[] = [];
        if (parentInvoice.invoice_items && parentInvoice.invoice_items.length > 0) {
          const newItems = parentInvoice.invoice_items.map((item: any) => ({
            invoice_id: newInvoice.id,
            description: item.description,
            quantity: item.quantity,
            unit_price: item.unit_price,
            unit_type: item.unit_type,
            discount_type: item.discount_type,
            discount_value: item.discount_value,
            discount_amount: item.discount_amount,
            tax_rate: item.tax_rate,
            tax_amount: item.tax_amount,
            sort_order: item.sort_order,
            service_id: item.service_id,
            catalog_item_id: item.catalog_item_id,
          }));

          const { data: insertedItems, error: itemsError } = await supabase
            .from("invoice_items")
            .insert(newItems)
            .select();

          if (itemsError) {
            console.error(`Error copying items for invoice ${newInvoice.id}:`, itemsError);
          } else {
            copiedItems.push(...(insertedItems || []));
          }
        }

        // Send the invoice email to the client
        const emailSent = await sendInvoiceEmail(
          { ...newInvoice, invoice_items: copiedItems },
          merchant,
          copiedItems
        );

        // If email failed, update status back to draft so merchant is aware
        if (!emailSent) {
          await supabase
            .from("invoices")
            .update({ status: "draft", sent_at: null })
            .eq("id", newInvoice.id);
          console.log(`Email failed for ${invoiceNumber}, reverted to draft`);
        }

        // Update parent invoice with next invoice date
        const shouldContinue = !parentInvoice.recurring_end_date || 
          new Date(parentInvoice.recurring_end_date) >= nextInvoiceDate;

        if (shouldContinue) {
          await supabase
            .from("invoices")
            .update({ next_invoice_date: format(nextInvoiceDate, "yyyy-MM-dd") })
            .eq("id", parentInvoice.id);
        } else {
          await supabase
            .from("invoices")
            .update({ is_recurring: false, next_invoice_date: null })
            .eq("id", parentInvoice.id);
        }

        // Log activity
        await supabase
          .from("invoice_activity")
          .insert({
            invoice_id: newInvoice.id,
            action: emailSent ? "sent" : "created",
            description: emailSent
              ? `Auto-generated and sent to ${newInvoice.client_email} from recurring invoice ${parentInvoice.invoice_number}`
              : `Auto-generated from recurring invoice ${parentInvoice.invoice_number} (email delivery failed)`,
            metadata: { parent_invoice_id: parentInvoice.id, email_sent: emailSent },
          });

        console.log(`Successfully processed invoice ${invoiceNumber} (email: ${emailSent ? 'sent' : 'failed'})`);
        results.push({ 
          parentId: parentInvoice.id, 
          newInvoiceId: newInvoice.id,
          invoiceNumber,
          emailSent,
          success: true 
        });

      } catch (err) {
        console.error(`Error processing invoice ${parentInvoice.id}:`, err);
        results.push({ parentId: parentInvoice.id, success: false, error: String(err) });
      }
    }

    console.log("Recurring invoice generation complete:", results);

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    console.error("Error in generate-recurring-invoices:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function calculateNextDate(fromDate: Date, interval: string): Date {
  switch (interval) {
    case "weekly":
      return addWeeks(fromDate, 1);
    case "biweekly":
      return addWeeks(fromDate, 2);
    case "monthly":
      return addMonths(fromDate, 1);
    case "quarterly":
      return addMonths(fromDate, 3);
    case "yearly":
      return addYears(fromDate, 1);
    default:
      return addMonths(fromDate, 1);
  }
}
