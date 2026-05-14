import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

// Format date-only strings (YYYY-MM-DD) without timezone shift
function formatLocalDateOnly(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return `${months[month - 1]} ${day}, ${year}`;
}

// Get today's date in YYYY-MM-DD format using US Eastern Time
function getTodayDateString(): string {
  const now = new Date();
  // Use Eastern Time for consistency
  const formatter = new Intl.DateTimeFormat('en-CA', { 
    timeZone: 'America/New_York',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  return formatter.format(now);
}

interface Invoice {
  id: string;
  invoice_number: string;
  client_name: string;
  client_email: string;
  due_date: string;
  total: number;
  amount_due: number;
  status: string;
  merchant_id: string;
  access_token: string;
  currency: string;
}

interface Merchant {
  id: string;
  business_name: string;
  email: string;
  phone: string;
}

interface InvoiceSettings {
  reminder_enabled: boolean;
  reminder_days_before: number[];
  overdue_reminder_days: number[];
}

function generateEmailHtml(
  type: "reminder" | "overdue",
  invoice: Invoice,
  merchant: Merchant,
  daysUntilDue: number,
  paymentUrl: string
): string {
  const isOverdue = type === "overdue";
  const headerColor = isOverdue ? "#EF4444" : "#7DD4D4";
  const headerText = isOverdue ? "PAYMENT OVERDUE" : "PAYMENT REMINDER";
  const daysText = isOverdue 
    ? `This invoice is ${Math.abs(daysUntilDue)} day${Math.abs(daysUntilDue) !== 1 ? 's' : ''} overdue.`
    : daysUntilDue === 0 
      ? "This invoice is due today."
      : `This invoice is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.`;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${headerText}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${headerColor} 0%, ${isOverdue ? '#DC2626' : '#5BC0C0'} 100%); padding: 30px 40px; text-align: center;">
              <h1 style="color: #ffffff; margin: 0; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
                ${headerText}
              </h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                Hi ${invoice.client_name},
              </p>
              
              <p style="color: #374151; font-size: 16px; line-height: 1.6; margin: 0 0 20px;">
                ${isOverdue 
                  ? `This is a reminder that your invoice from <strong>${merchant.business_name}</strong> is now overdue.`
                  : `This is a friendly reminder about your upcoming invoice from <strong>${merchant.business_name}</strong>.`
                }
              </p>
              
              <!-- Invoice Details Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f9fafb; border-radius: 8px; margin: 24px 0;">
                <tr>
                  <td style="padding: 24px;">
                    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Invoice Number</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <strong style="color: #111827; font-size: 14px;">${invoice.invoice_number}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb;">
                          <span style="color: #6b7280; font-size: 14px;">Due Date</span>
                        </td>
                        <td style="padding: 8px 0; border-bottom: 1px solid #e5e7eb; text-align: right;">
                          <strong style="color: ${isOverdue ? '#EF4444' : '#111827'}; font-size: 14px;">${formatLocalDateOnly(invoice.due_date)}</strong>
                        </td>
                      </tr>
                      <tr>
                        <td style="padding: 8px 0;">
                          <span style="color: #6b7280; font-size: 14px;">Amount Due</span>
                        </td>
                        <td style="padding: 8px 0; text-align: right;">
                          <strong style="color: #111827; font-size: 20px;">$${Number(invoice.amount_due).toFixed(2)}</strong>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
              
              <!-- Status Message -->
              <p style="color: ${isOverdue ? '#EF4444' : '#6b7280'}; font-size: 14px; text-align: center; margin: 0 0 24px; font-weight: ${isOverdue ? 'bold' : 'normal'};">
                ${daysText}
              </p>
              
              <!-- CTA Button -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <a href="${paymentUrl}" style="display: inline-block; background: linear-gradient(135deg, #7DD4D4 0%, #5BC0C0 100%); color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: bold;">
                      Pay Now
                    </a>
                  </td>
                </tr>
              </table>
              
              <p style="color: #6b7280; font-size: 14px; line-height: 1.6; margin: 24px 0 0; text-align: center;">
                If you have any questions about this invoice, please contact us at<br>
                <a href="mailto:${merchant.email || 'support@pawbucks.app'}" style="color: #7DD4D4;">${merchant.email || merchant.business_name}</a>
              </p>
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="background-color: #f9fafb; padding: 24px 40px; text-align: center; border-top: 1px solid #e5e7eb;">
              <p style="color: #9ca3af; font-size: 12px; margin: 0;">
                This is an automated reminder from ${merchant.business_name} via PawBucks.
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log("Starting invoice reminder check...");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date string in Eastern Time for consistent comparison
    const todayStr = getTodayDateString();
    // Parse today as local date for date math
    const [todayYear, todayMonth, todayDay] = todayStr.split('-').map(Number);
    const today = new Date(todayYear, todayMonth - 1, todayDay);
    today.setHours(0, 0, 0, 0);

    // Get all unpaid invoices (sent, viewed, partially_paid, overdue)
    const { data: invoices, error: invoicesError } = await supabase
      .from("invoices")
      .select(`
        id,
        invoice_number,
        client_name,
        client_email,
        due_date,
        total,
        amount_due,
        status,
        merchant_id,
        access_token,
        currency
      `)
      .in("status", ["sent", "viewed", "partially_paid", "overdue"])
      .gt("amount_due", 0);

    if (invoicesError) {
      console.error("Error fetching invoices:", invoicesError);
      throw invoicesError;
    }

    console.log(`Found ${invoices?.length || 0} unpaid invoices`);

    if (!invoices || invoices.length === 0) {
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0, message: "No unpaid invoices found" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get merchant IDs
    const merchantIds = [...new Set(invoices.map(inv => inv.merchant_id))];

    // Get merchant details
    const { data: merchants, error: merchantsError } = await supabase
      .from("merchants")
      .select("id, business_name, email, phone")
      .in("id", merchantIds);

    if (merchantsError) {
      console.error("Error fetching merchants:", merchantsError);
      throw merchantsError;
    }

    // Get invoice settings for each merchant
    const { data: allSettings, error: settingsError } = await supabase
      .from("invoice_settings")
      .select("merchant_id, reminder_enabled, reminder_days_before, overdue_reminder_days")
      .in("merchant_id", merchantIds);

    if (settingsError) {
      console.error("Error fetching settings:", settingsError);
    }

    const merchantMap = new Map(merchants?.map(m => [m.id, m]) || []);
    const settingsMap = new Map(allSettings?.map(s => [s.merchant_id, s]) || []);

    let remindersSent = 0;
    const errors: string[] = [];

    for (const invoice of invoices) {
      const merchant = merchantMap.get(invoice.merchant_id);
      if (!merchant) {
        console.log(`Merchant not found for invoice ${invoice.invoice_number}`);
        continue;
      }

      // Get settings or use defaults
      const settings = settingsMap.get(invoice.merchant_id) || {
        reminder_enabled: true,
        reminder_days_before: [7, 3, 1],
        overdue_reminder_days: [1, 7, 14, 30],
      };

      if (!settings.reminder_enabled) {
        console.log(`Reminders disabled for merchant ${merchant.business_name}`);
        continue;
      }

      // Parse due_date as local date (YYYY-MM-DD format)
      const [dueYear, dueMonth, dueDay] = invoice.due_date.split('-').map(Number);
      const dueDate = new Date(dueYear, dueMonth - 1, dueDay);
      dueDate.setHours(0, 0, 0, 0);
      const diffTime = dueDate.getTime() - today.getTime();
      const daysUntilDue = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      let shouldSendReminder = false;
      let reminderType: "reminder" | "overdue" = "reminder";

      if (daysUntilDue > 0) {
        // Before due date - check reminder_days_before
        const reminderDays = settings.reminder_days_before || [7, 3, 1];
        shouldSendReminder = reminderDays.includes(daysUntilDue);
        reminderType = "reminder";
      } else if (daysUntilDue === 0) {
        // Due today — send a friendly reminder, NOT an overdue notice.
        shouldSendReminder = true;
        reminderType = "reminder";
      } else {
        // Strictly after due date - check overdue_reminder_days
        const overdueDays = settings.overdue_reminder_days || [1, 7, 14, 30];
        const daysPastDue = Math.abs(daysUntilDue);
        shouldSendReminder = overdueDays.includes(daysPastDue);
        reminderType = "overdue";

        // Update invoice status to overdue if not already
        if (invoice.status !== "overdue") {
          await supabase
            .from("invoices")
            .update({ status: "overdue" })
            .eq("id", invoice.id);
        }
      }

      if (!shouldSendReminder) {
        continue;
      }

      // Check if we already sent a reminder today for this invoice
      const todayStart = new Date(today);
      const todayEnd = new Date(today);
      todayEnd.setHours(23, 59, 59, 999);

      const { data: existingActivity } = await supabase
        .from("invoice_activity")
        .select("id")
        .eq("invoice_id", invoice.id)
        .in("action", ["reminder_sent", "overdue_reminder_sent"])
        .gte("created_at", todayStart.toISOString())
        .lte("created_at", todayEnd.toISOString())
        .limit(1);

      if (existingActivity && existingActivity.length > 0) {
        console.log(`Reminder already sent today for invoice ${invoice.invoice_number}`);
        continue;
      }

      // Generate payment URL - must match InvoicePayment route: /invoice/:invoiceId/pay?token=
      const appUrl = Deno.env.get("APP_URL") || "https://pawbucks.app";
      const paymentUrl = `${appUrl}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;

      // Send reminder email
      const subject = reminderType === "overdue"
        ? `⚠️ Overdue: Invoice ${invoice.invoice_number} from ${merchant.business_name}`
        : `Reminder: Invoice ${invoice.invoice_number} due ${daysUntilDue === 0 ? 'today' : `in ${daysUntilDue} days`}`;

      const html = generateEmailHtml(
        reminderType,
        invoice,
        merchant,
        daysUntilDue,
        paymentUrl
      );

      try {
        const emailResponse = await resend.emails.send({
          from: `${merchant.business_name} <noreply@pawbucks.app>`,
          to: [invoice.client_email],
          subject,
          html,
        });

        console.log(`Reminder sent for invoice ${invoice.invoice_number}:`, emailResponse);

        // Log the reminder activity
        await supabase.from("invoice_activity").insert({
          invoice_id: invoice.id,
          action: reminderType === "overdue" ? "overdue_reminder_sent" : "reminder_sent",
          description: `${reminderType === "overdue" ? "Overdue reminder" : "Payment reminder"} email sent to ${invoice.client_email}`,
          performed_by: "system",
          metadata: {
            days_until_due: daysUntilDue,
            reminder_type: reminderType,
          },
        });

        remindersSent++;
      } catch (emailError: any) {
        console.error(`Failed to send reminder for invoice ${invoice.invoice_number}:`, emailError);
        errors.push(`Invoice ${invoice.invoice_number}: ${emailError.message}`);
      }
    }

    console.log(`Reminder check complete. Sent ${remindersSent} reminders.`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: remindersSent,
        errors: errors.length > 0 ? errors : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error in send-invoice-reminders:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
