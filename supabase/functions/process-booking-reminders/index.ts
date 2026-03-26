import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
const LOGO_URL = "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const formatTime12 = (time24: string): string => {
  const [h, m] = time24.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

const formatDateReadable = (dateStr: string): string => {
  const d = new Date(dateStr + "T12:00:00");
  return d.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
};

const wrapTemplate = (content: string): string => `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#fff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:600px;">
  <tr><td style="padding:32px;text-align:center;border-radius:12px 12px 0 0;">
    <img src="${LOGO_URL}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
  </td></tr>
  <tr><td style="padding:0 32px 32px;">${content}</td></tr>
  <tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table></body></html>`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time in PT (America/Los_Angeles)
    const now = new Date();
    // We work with UTC and compare against booking times stored as PT
    const today = now.toISOString().split("T")[0];
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Current PT hour approximation (UTC - 8, rough)
    const ptHour = (now.getUTCHours() - 8 + 24) % 24;
    const ptMinute = now.getUTCMinutes();
    const currentPTTime = `${String(ptHour).padStart(2, "0")}:${String(ptMinute).padStart(2, "0")}:00`;

    // 1 hour from now in PT
    const oneHourLaterHour = (ptHour + 1) % 24;
    const oneHourLaterDate = oneHourLaterHour < ptHour ? tomorrow : today; // rolled past midnight
    const oneHourLaterTime = `${String(oneHourLaterHour).padStart(2, "0")}:${String(ptMinute).padStart(2, "0")}:00`;

    let sent24h = 0;
    let sent1h = 0;

    // === 24-HOUR REMINDERS ===
    // Find bookings for tomorrow that haven't received a 24h reminder
    const { data: bookings24h, error: err24 } = await supabase
      .from("service_bookings")
      .select(`
        id, booking_date, start_time, end_time, customer_email, customer_name, notes, total_price,
        merchant_services(name),
        merchants(business_name)
      `)
      .eq("booking_date", tomorrow)
      .in("status", ["confirmed", "pending"])
      .not("customer_email", "is", null);

    if (err24) {
      console.error("Error fetching 24h bookings:", err24);
    }

    for (const booking of bookings24h || []) {
      if (!booking.customer_email) continue;

      const serviceName = (booking as any).merchant_services?.name || "Service";
      const merchantName = (booking as any).merchants?.business_name || "Your Provider";
      const timeFormatted = formatTime12(booking.start_time);
      const dateFormatted = formatDateReadable(booking.booking_date);

      const html = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#fef3c7;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">⏰</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#92400e;">Appointment Tomorrow!</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${booking.customer_name || "there"},</p>
        <p style="color:#374151;line-height:1.6;">Just a friendly reminder — your appointment is <strong>tomorrow</strong>.</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Business</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${merchantName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted} PT</td></tr>
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">Need to cancel or reschedule? Visit <strong>My Bookings</strong> in your PawBucks dashboard.</p>`;

      try {
        const { error: emailErr } = await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [booking.customer_email],
          subject: `Reminder: ${serviceName} Tomorrow at ${timeFormatted}`,
          html: wrapTemplate(html),
        });
        if (!emailErr) sent24h++;
        else console.error(`24h reminder failed for ${booking.id}:`, emailErr);
      } catch (e) {
        console.error(`24h reminder error for ${booking.id}:`, e);
      }
    }

    // === 1-HOUR REMINDERS ===
    // Find bookings for today starting in ~1 hour window (±15 min)
    const windowStart = `${String(oneHourLaterHour).padStart(2, "0")}:${String(Math.max(0, ptMinute - 15)).padStart(2, "0")}:00`;
    const windowEnd = `${String(oneHourLaterHour).padStart(2, "0")}:${String(Math.min(59, ptMinute + 15)).padStart(2, "0")}:00`;

    const { data: bookings1h, error: err1h } = await supabase
      .from("service_bookings")
      .select(`
        id, booking_date, start_time, end_time, customer_email, customer_name,
        merchant_services(name),
        merchants(business_name)
      `)
      .eq("booking_date", today)
      .in("status", ["confirmed", "pending"])
      .gte("start_time", windowStart)
      .lte("start_time", windowEnd)
      .not("customer_email", "is", null);

    if (err1h) {
      console.error("Error fetching 1h bookings:", err1h);
    }

    for (const booking of bookings1h || []) {
      if (!booking.customer_email) continue;

      const serviceName = (booking as any).merchant_services?.name || "Service";
      const merchantName = (booking as any).merchants?.business_name || "Your Provider";
      const timeFormatted = formatTime12(booking.start_time);

      const html = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#dbeafe;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">🔔</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#1e40af;">Your Appointment is in 1 Hour</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${booking.customer_name || "there"},</p>
        <p style="color:#374151;line-height:1.6;">Your appointment starts <strong>in about 1 hour</strong>. Time to get ready!</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Business</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${merchantName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted} PT</td></tr>
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">We look forward to seeing you! 🐾</p>`;

      try {
        const { error: emailErr } = await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [booking.customer_email],
          subject: `Starting Soon: ${serviceName} in 1 Hour`,
          html: wrapTemplate(html),
        });
        if (!emailErr) sent1h++;
        else console.error(`1h reminder failed for ${booking.id}:`, emailErr);
      } catch (e) {
        console.error(`1h reminder error for ${booking.id}:`, e);
      }
    }

    console.log(`Booking reminders processed: ${sent24h} 24h, ${sent1h} 1h`);

    return new Response(JSON.stringify({
      success: true,
      sent_24h: sent24h,
      sent_1h: sent1h,
      checked_24h: bookings24h?.length || 0,
      checked_1h: bookings1h?.length || 0,
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in process-booking-reminders:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
