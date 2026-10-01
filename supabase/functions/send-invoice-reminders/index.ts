import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { checkInternalSecret } from "../_shared/internal-auth.ts";
import { currentHourInTz } from "../_shared/tz.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

const TARGET_LOCAL_HOUR = 9; // 9 AM in each merchant's timezone

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
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
  title?: string | null;
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
  logo_url?: string | null;
  accent_color?: string | null;
}

function generateEmailHtml(
  type: "reminder" | "overdue",
  invoice: Invoice,
  merchant: Merchant,
  daysUntilDue: number,
  paymentUrl: string,
  logoUrl?: string | null,
  accentColor?: string | null
): string {
  const isOverdue = type === "overdue";
  const daysOverdue = Math.abs(daysUntilDue);
  const initials = (merchant.business_name || "")
    .split(/\s+/)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "M";

  let headerText = "Payment reminder";
  let badgeText = daysUntilDue === 0
    ? "Due today"
    : `Due in ${daysUntilDue} day${daysUntilDue !== 1 ? "s" : ""}`;
  let badgeBackground = "#e6f5f3";
  let badgeColor = "#2E9E8F";
  let noticeBackground = "#f7fbfa";
  let noticeBorder = "#d7eeeb";
  let noticeColor = "#247d72";
  let noticeText = "A friendly reminder that your payment is due. Please settle this invoice when you have a moment.";

  if (isOverdue) {
    headerText = daysOverdue > 14 ? "Final payment notice" : "Payment overdue";
    badgeText = `${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue`;
    badgeBackground = daysOverdue <= 3 ? "#fff7ed" : "#fef2f2";
    badgeColor = daysOverdue <= 3 ? "#c2410c" : "#b91c1c";
    noticeBackground = daysOverdue <= 3 ? "#fffaf5" : "#fff7f7";
    noticeBorder = daysOverdue <= 3 ? "#fed7aa" : "#fecaca";
    noticeColor = daysOverdue <= 3 ? "#9a3412" : "#991b1b";
    noticeText = daysOverdue <= 3
      ? "A friendly reminder — this happens. Please settle this invoice when you have a moment."
      : daysOverdue <= 14
        ? "Payment is now urgently required. Please settle this outstanding balance immediately."
        : "This is a final notice. Unpaid invoices may be referred to collections. Please pay now to avoid service interruption.";
  }

  const savedAccent = accentColor?.trim();
  const brandColor = savedAccent && /^#[0-9a-f]{6}$/i.test(savedAccent) ? savedAccent : "#2E9E8F";
  const merchantName = escapeHtml(merchant.business_name);
  const clientName = escapeHtml(invoice.client_name);
  const serviceName = escapeHtml(invoice.title || `Invoice #${invoice.invoice_number}`);
  const invoiceNumber = escapeHtml(invoice.invoice_number);
  const merchantEmail = merchant.email ? escapeHtml(merchant.email) : "";
  const merchantPhone = merchant.phone ? escapeHtml(merchant.phone) : "";
  const formattedDueDate = formatLocalDateOnly(invoice.due_date);
  const formattedAmount = `$${Number(invoice.amount_due).toFixed(2)}`;
  const invoiceUrl = paymentUrl.replace("/pay", "");
  const merchantIdentity = logoUrl
    ? `<img src="${encodeURI(logoUrl)}" alt="${merchantName}" style="height:64px;width:64px;border-radius:50%;background:#ffffff;padding:4px;margin-bottom:14px;object-fit:cover;" />`
    : `<div style="height:64px;width:64px;line-height:64px;border-radius:50%;background:rgba(255,255,255,0.18);color:#ffffff;font-weight:800;font-size:22px;margin:0 auto 14px;">${escapeHtml(initials)}</div>`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(headerText)} — ${merchantName}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f7f7;color:#1a1a1a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f5f7f7;">
    <tr>
      <td align="center" style="padding:20px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(46,158,143,0.08);">
          <tr>
            <td style="background:${brandColor};padding:32px 24px;text-align:center;">
              ${merchantIdentity}
              <h1 style="color:#ffffff;margin:0;font-size:22px;font-weight:700;">${merchantName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;text-align:center;">
              <p style="margin:0;font-size:12px;letter-spacing:0.12em;color:${brandColor};text-transform:uppercase;font-weight:600;">${escapeHtml(headerText)}</p>
              <h2 style="margin:6px 0 4px;color:#1a1a1a;font-size:24px;font-weight:700;">Invoice #${invoiceNumber}</h2>
              <p style="margin:0 0 12px;color:#6b7280;font-size:14px;">${serviceName}</p>
              <span style="display:inline-block;background:${badgeBackground};color:${badgeColor};font-weight:600;font-size:13px;padding:6px 14px;border-radius:999px;">${escapeHtml(badgeText)}</span>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px 0;">
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 8px;">Hi ${clientName},</p>
              <p style="color:#374151;font-size:15px;line-height:1.6;margin:0;">This is a reminder that your invoice from <strong>${merchantName}</strong> is ${isOverdue ? "overdue" : "due soon"}.</p>
            </td>
          </tr>
          <tr>
            <td style="padding:20px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f7fbfa;border-radius:12px;">
                <tr>
                  <td style="padding:16px;vertical-align:top;">
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Due date</p>
                    <p style="margin:4px 0 0;font-weight:600;color:${isOverdue ? badgeColor : "#1a1a1a"};font-size:14px;">${formattedDueDate}</p>
                  </td>
                  <td style="padding:16px;vertical-align:top;text-align:right;">
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em;">Amount due</p>
                    <p style="margin:4px 0 0;font-weight:800;color:${brandColor};font-size:22px;">${formattedAmount}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 24px;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="background:${noticeBackground};border:1px solid ${noticeBorder};border-radius:10px;padding:14px 16px;text-align:center;">
                    <p style="color:${noticeColor};font-size:13px;line-height:1.55;margin:0;font-weight:600;">${escapeHtml(noticeText)}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="padding:0 24px 28px;text-align:center;">
              <a href="${paymentUrl}" style="display:inline-block;background:${brandColor};color:#ffffff;text-decoration:none;padding:16px 44px;border-radius:12px;font-weight:700;font-size:16px;">Pay now — ${formattedAmount}</a>
              <p style="margin:14px 0 0;color:#6b7280;font-size:12px;">Secure payment via pawbucks.app</p>
              <p style="margin:10px 0 0;"><a href="${invoiceUrl}" style="color:${brandColor};font-size:13px;text-decoration:none;font-weight:600;">View full invoice</a></p>
            </td>
          </tr>
          <tr>
            <td style="background:#f7fbfa;padding:22px 24px;text-align:center;border-top:1px solid #e6f5f3;">
              <p style="margin:0;color:#1a1a1a;font-size:13px;font-weight:600;">Questions about this invoice?</p>
              ${merchantPhone ? `<p style="margin:6px 0 0;"><a href="tel:${encodeURIComponent(merchant.phone)}" style="color:${brandColor};text-decoration:none;font-weight:600;font-size:14px;">${merchantPhone}</a></p>` : ""}
              ${merchantEmail ? `<p style="margin:4px 0 0;"><a href="mailto:${encodeURIComponent(merchant.email)}" style="color:${brandColor};text-decoration:none;font-size:13px;">${merchantEmail}</a></p>` : ""}
              <p style="margin:14px 0 0;color:#9ca3af;font-size:12px;">Powered by <a href="https://pawbucks.app" style="color:${brandColor};text-decoration:none;font-weight:600;">pawbucks.app</a></p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders }
);
  }

  const _authResp = await checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

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
        currency,
        title
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
      .select("id, business_name, email, phone, user_id")
      .in("id", merchantIds);

    if (merchantsError) {
      console.error("Error fetching merchants:", merchantsError);
      throw merchantsError;
    }

    // Resolve each merchant's owner timezone for per-merchant local-hour gating.
    const merchantUserIds = (merchants || []).map((m) => m.user_id).filter(Boolean);
    const { data: ownerProfiles } = merchantUserIds.length > 0
      ? await supabase.from("profiles").select("id, timezone").in("id", merchantUserIds)
      : { data: [] as { id: string; timezone: string | null }[] };
    const tzByUserId = new Map<string, string | null>();
    for (const p of ownerProfiles || []) tzByUserId.set(p.id, p.timezone);
    const merchantTz = new Map<string, string | null>();
    for (const m of merchants || []) merchantTz.set(m.id, tzByUserId.get(m.user_id) ?? null);

    // Get invoice settings for each merchant
    const { data: allSettings, error: settingsError } = await supabase
      .from("invoice_settings")
      .select("merchant_id, reminder_enabled, reminder_days_before, overdue_reminder_days, logo_url, accent_color")
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

      // Per-merchant timezone gate: only fire at 9 AM local for the merchant.
      // (Invoice clients aren't always registered users, so we anchor on the
      // sending merchant's timezone instead of the recipient's.)
      const tz = merchantTz.get(invoice.merchant_id);
      if (currentHourInTz(tz) !== TARGET_LOCAL_HOUR) continue;

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
        paymentUrl,
        settings.logo_url,
        settings.accent_color
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
