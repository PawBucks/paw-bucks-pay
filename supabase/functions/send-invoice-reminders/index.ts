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

import { pawBucksLogoBase64 } from "./logo.ts";

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
  
  // Extract merchant initials
  const initials = (merchant.business_name || "")
    .split(/\s+/)
    .map(w => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase() || "M";

  // Escalation tiers
  let headerGradient = "linear-gradient(135deg, #12a8b3 0%, #0a8f9a 100%)";
  let headerText = "PAYMENT REMINDER";
  let statusText = daysUntilDue === 0 
    ? "This invoice is due today."
    : `This invoice is due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}.`;
  let escalationText = "A friendly reminder that your payment is due. Please settle this invoice when you have a moment.";
  let calloutBg = "#ecfeff";
  let calloutBorder = "#cffafe";
  let calloutColor = "#0891b2";

  if (isOverdue) {
    headerText = "PAYMENT OVERDUE";
    if (daysOverdue <= 3) {
      headerGradient = "linear-gradient(135deg, #f97316 0%, #ea580c 100%)";
      statusText = `This invoice is ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''} overdue.`;
      escalationText = "A friendly reminder — this happens! Please settle this invoice when you have a moment.";
      calloutBg = "#fff7ed";
      calloutBorder = "#fed7aa";
      calloutColor = "#ea580c";
    } else if (daysOverdue <= 14) {
      headerGradient = "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)";
      statusText = `This invoice is ${daysOverdue} days overdue.`;
      escalationText = "Payment is now urgently required. Please settle this outstanding balance immediately.";
      calloutBg = "#fef2f2";
      calloutBorder = "#fecaca";
      calloutColor = "#dc2626";
    } else {
      headerGradient = "linear-gradient(135deg, #991b1b 0%, #7f1d1d 100%)";
      headerText = "FINAL NOTICE";
      statusText = `This invoice is ${daysOverdue} days overdue.`;
      escalationText = "This is a final notice. Unpaid invoices may be referred to collections. Please pay now to avoid service interruption.";
      calloutBg = "#fef2f2";
      calloutBorder = "#fecaca";
      calloutColor = "#991b1b";
    }
  }

  // Brand colors (Teal fallback)
  const brandColor = accentColor || "#12a8b3";
  const brandDark = accentColor ? `${accentColor}cc` : "#0a8f9a"; // slight opacity or fallback dark

  // Display logo or initial circle
  const logoHtml = logoUrl 
    ? `<img src="${logoUrl}" alt="${escapeHtml(merchant.business_name)}" style="max-height:44px;max-width:150px;border-radius:6px;vertical-align:middle;" />`
    : `<table role="presentation" cellspacing="0" cellpadding="0">
        <tr><td style="width:44px;height:44px;border-radius:10px;background:${brandColor};text-align:center;vertical-align:middle;font-size:15px;font-weight:800;color:#ffffff;font-family:-apple-system,sans-serif;">
          ${initials}
        </td></tr>
      </table>`;

  const serviceName = invoice.title || `Invoice #${invoice.invoice_number}`;
  const formattedDueDate = formatLocalDateOnly(invoice.due_date);
  const formattedAmount = `$${Number(invoice.amount_due).toFixed(2)}`;

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${escapeHtml(headerText)} — ${escapeHtml(merchant.business_name)}</title>
</head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f4f4f5;">

<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f4f4f5;">
<tr>
<td align="center" style="padding:40px 20px;">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:14px;overflow:hidden;box-shadow:0 4px 20px rgba(10,31,38,0.1);max-width:600px;">

  <!-- PAWBUCKS LOGO STRIP -->
  <tr>
    <td style="padding:18px 40px;text-align:center;border-bottom:1px solid #f1f5f9;">
      <img src="data:image/png;base64,${pawBucksLogoBase64}" alt="PawBucks" style="height:24px;display:inline-block;" />
    </td>
  </tr>

  <!-- HEADER — color escalates by tier or uses friendly brand theme -->
  <tr>
    <td style="background:${headerGradient};padding:28px 40px;text-align:center;">
      <h1 style="color:#ffffff;margin:0;font-size:21px;font-weight:800;letter-spacing:0.05em;">
        ${headerText}
      </h1>
    </td>
  </tr>

  <!-- MERCHANT STRIP -->
  <tr>
    <td style="padding:20px 40px 0;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td width="44" style="vertical-align:middle;">
            ${logoHtml}
          </td>
          <td style="padding-left:12px;vertical-align:middle;">
            <div style="font-size:15px;font-weight:700;color:#0f172a;">${escapeHtml(merchant.business_name)}</div>
            <div style="font-size:12px;color:#94a3b8;">
              ${merchant.email || ''} ${merchant.phone ? `· ${merchant.phone}` : ''}
            </div>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- CONTENT -->
  <tr>
    <td style="padding:24px 40px 40px;">
      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 18px;">Hi ${escapeHtml(invoice.client_name)},</p>

      <p style="color:#374151;font-size:15px;line-height:1.6;margin:0 0 18px;">
        This is a reminder that your invoice from <strong>${escapeHtml(merchant.business_name)}</strong> is ${isOverdue ? "now overdue" : "due soon"}.
      </p>

      <!-- Invoice Details Box -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#f9fafb;border-radius:10px;margin:20px 0;border:1px solid #f1f5f9;">
        <tr>
          <td style="padding:20px 22px;">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:13px;">Service</span>
                </td>
                <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
                  <strong style="color:#111827;font-size:13px;">${serviceName}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:13px;">Invoice Number</span>
                </td>
                <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
                  <strong style="color:#111827;font-size:13px;font-family:monospace;">${escapeHtml(invoice.invoice_number)}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;">
                  <span style="color:#6b7280;font-size:13px;">Due Date</span>
                </td>
                <td style="padding:7px 0;border-bottom:1px solid #e5e7eb;text-align:right;">
                  <strong style="color:${isOverdue ? '#ea580c' : '#111827'};font-size:13px;">${formattedDueDate}</strong>
                </td>
              </tr>
              <tr>
                <td style="padding:10px 0 0;">
                  <span style="color:#6b7280;font-size:13px;">Amount Due</span>
                </td>
                <td style="padding:10px 0 0;text-align:right;">
                  <strong style="color:#111827;font-size:22px;">${formattedAmount}</strong>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- Status callout — escalates by tier -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:0 0 24px;">
        <tr>
          <td style="background-color:${calloutBg};border:1px solid ${calloutBorder};border-radius:8px;padding:12px 16px;text-align:center;">
            <p style="color:${calloutColor};font-size:13px;margin:0;font-weight:700;">
              ${statusText}
            </p>
            <p style="color:${calloutColor};font-size:12px;margin:6px 0 0;opacity:0.85;">
              ${escalationText}
            </p>
          </td>
        </tr>
      </table>

      <!-- CTA Button — always brand color, never the alert color -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
        <tr>
          <td align="center">
            <a href="${paymentUrl}"
              style="display:inline-block;background:linear-gradient(135deg,${brandColor} 0%,${brandDark} 100%);color:#ffffff;text-decoration:none;padding:15px 44px;border-radius:10px;font-size:15px;font-weight:700;">
              Pay Now — ${formattedAmount}
            </a>
          </td>
        </tr>
      </table>

      <!-- Secondary actions -->
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:14px;">
        <tr>
          <td align="center">
            <a href="${paymentUrl.replace('/pay', '')}"
              style="display:inline-block;color:#64748b;text-decoration:none;font-size:13px;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;margin:0 4px;">
              View Full Invoice
            </a>
            ${merchant.email ? `
            <a href="mailto:${merchant.email}"
              style="display:inline-block;color:#64748b;text-decoration:none;font-size:13px;padding:8px 14px;border:1px solid #e2e8f0;border-radius:8px;margin:0 4px;">
              Message ${escapeHtml(merchant.business_name)}
            </a>` : ''}
          </td>
        </tr>
      </table>

      ${merchant.email ? `
      <p style="color:#9ca3af;font-size:12px;line-height:1.6;margin:24px 0 0;text-align:center;">
        Questions about this invoice? Contact ${escapeHtml(merchant.business_name)} directly at<br />
        <a href="mailto:${merchant.email}" style="color:${brandColor};">${merchant.email}</a>
      </p>` : ''}
    </td>
  </tr>

  <!-- FOOTER -->
  <tr>
    <td style="background-color:#f9fafb;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
      <p style="color:#9ca3af;font-size:11px;margin:0;line-height:1.6;">
        This is an automated reminder from ${escapeHtml(merchant.business_name)} via PawBucks.<br/>
        PawBucks, Inc. · <a href="mailto:support@pawbucks.app" style="color:#9ca3af;">support@pawbucks.app</a>
      </p>
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
