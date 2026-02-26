import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { addDays, addWeeks, addMonths, addYears, format } from "https://esm.sh/date-fns@3.6.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

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
      .lte("next_invoice_date", today)
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

        // Get the next invoice number for this merchant
        const { data: settings, error: settingsError } = await supabase
          .from("invoice_settings")
          .select("invoice_prefix, next_invoice_number")
          .eq("merchant_id", parentInvoice.merchant_id)
          .single();

        let invoiceNumber = "";
        if (settings) {
          invoiceNumber = `${settings.invoice_prefix || "INV-"}${String(settings.next_invoice_number || 1).padStart(4, "0")}`;
          // Increment the invoice number
          await supabase
            .from("invoice_settings")
            .update({ next_invoice_number: (settings.next_invoice_number || 1) + 1 })
            .eq("merchant_id", parentInvoice.merchant_id);
        } else {
          invoiceNumber = `INV-${Date.now()}`;
        }

        // Calculate new dates
        const issueDate = new Date();
        const paymentTerms = parentInvoice.payment_terms || 30;
        const dueDate = addDays(issueDate, paymentTerms);

        // Calculate next invoice date based on interval
        const nextInvoiceDate = calculateNextDate(issueDate, parentInvoice.recurring_interval);

        // Generate new access token
        const accessToken = crypto.randomUUID();

        // Create the new invoice (copy from parent)
        const { data: newInvoice, error: createError } = await supabase
          .from("invoices")
          .insert({
            merchant_id: parentInvoice.merchant_id,
            client_id: parentInvoice.client_id,
            invoice_number: invoiceNumber,
            status: "draft",
            issue_date: format(issueDate, "yyyy-MM-dd"),
            due_date: format(dueDate, "yyyy-MM-dd"),
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
            is_recurring: false, // Child invoices are not recurring themselves
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
            subtotal: item.subtotal,
            total: item.total,
            sort_order: item.sort_order,
            service_id: item.service_id,
            catalog_item_id: item.catalog_item_id,
          }));

          const { error: itemsError } = await supabase
            .from("invoice_items")
            .insert(newItems);

          if (itemsError) {
            console.error(`Error copying items for invoice ${newInvoice.id}:`, itemsError);
          }
        }

        // Update parent invoice with next invoice date
        // Check if we should continue or stop recurring
        const shouldContinue = !parentInvoice.recurring_end_date || 
          new Date(parentInvoice.recurring_end_date) >= nextInvoiceDate;

        if (shouldContinue) {
          await supabase
            .from("invoices")
            .update({ next_invoice_date: format(nextInvoiceDate, "yyyy-MM-dd") })
            .eq("id", parentInvoice.id);
        } else {
          // End the recurring series
          await supabase
            .from("invoices")
            .update({ 
              is_recurring: false,
              next_invoice_date: null 
            })
            .eq("id", parentInvoice.id);
        }

        // Log activity on the new invoice
        await supabase
          .from("invoice_activity")
          .insert({
            invoice_id: newInvoice.id,
            action: "created",
            description: `Auto-generated from recurring invoice ${parentInvoice.invoice_number}`,
            metadata: { parent_invoice_id: parentInvoice.id },
          });

        console.log(`Successfully created invoice ${invoiceNumber} from recurring ${parentInvoice.invoice_number}`);
        results.push({ 
          parentId: parentInvoice.id, 
          newInvoiceId: newInvoice.id,
          invoiceNumber,
          success: true 
        });

      } catch (err) {
        console.error(`Error processing invoice ${parentInvoice.id}:`, err);
        results.push({ parentId: parentInvoice.id, success: false, error: String(err) });
      }
    }

    console.log("Recurring invoice generation complete:", results);

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: results.length,
        results 
      }),
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
