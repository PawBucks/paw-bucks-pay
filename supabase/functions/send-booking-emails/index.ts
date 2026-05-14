import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOGO_URL = "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";

interface BookingEmailRequest {
  type:
    | "confirmation"
    | "reminder_24h"
    | "reminder_1h"
    | "cancellation"
    | "rescheduled"
    | "reschedule";
  bookingId?: string;
  // Direct data (for immediate sends from client)
  customerEmail?: string;
  customerName?: string;
  merchantName?: string;
  serviceName?: string;
  bookingDate?: string;
  startTime?: string;
  endTime?: string;
  totalPrice?: number;
  notes?: string;
  // For rescheduled
  previousDate?: string;
  previousTime?: string;
  cancellationReason?: string;
  /** Who initiated the action (used for merchant-facing copy on reschedule/cancel) */
  initiator?: "customer" | "merchant" | "system";
}

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

const generateICS = (date: string, startTime: string, endTime: string, summary: string, location: string, email: string): string => {
  const [sh, sm] = startTime.split(":").map(Number);
  const [eh, em] = endTime.split(":").map(Number);
  // Convert PT to UTC (+8h rough)
  const makeUTC = (d: string, h: number, m: number) => {
    const dt = new Date(`${d}T00:00:00`);
    dt.setUTCHours(h + 8, m, 0, 0);
    const Y = dt.getUTCFullYear();
    const M = String(dt.getUTCMonth() + 1).padStart(2, "0");
    const D = String(dt.getUTCDate()).padStart(2, "0");
    const HH = String(dt.getUTCHours()).padStart(2, "0");
    const MM = String(dt.getUTCMinutes()).padStart(2, "0");
    return `${Y}${M}${D}T${HH}${MM}00Z`;
  };
  const uid = `pawbucks-booking-${Date.now()}-${Math.random().toString(36).slice(2)}@pawbucks.app`;
  const now = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PawBucks//Booking//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${makeUTC(date, sh, sm)}
DTEND:${makeUTC(date, eh, em)}
SUMMARY:${summary}
LOCATION:${location}
ATTENDEE:mailto:${email}
STATUS:CONFIRMED
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder: Your appointment is in 1 hour
TRIGGER:-PT60M
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder: Your appointment is in 15 minutes
TRIGGER:-PT15M
END:VALARM
END:VEVENT
END:VCALENDAR`;
};

const wrapInBrandedTemplate = (content: string): string => `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
<tr><td align="center">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:600px;">
  <tr><td style="padding:32px;text-align:center;border-radius:12px 12px 0 0;">
    <img src="${LOGO_URL}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
  </td></tr>
  <tr><td style="padding:0 32px 32px;">${content}</td></tr>
  <tr><td style="background-color:#f9fafb;padding:24px 32px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
    <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: BookingEmailRequest = await req.json();
    const { type } = body;

    let customerEmail = body.customerEmail;
    let customerName = body.customerName;
    let merchantName = body.merchantName;
    let serviceName = body.serviceName;
    let bookingDate = body.bookingDate;
    let startTime = body.startTime;
    let endTime = body.endTime;
    let totalPrice = body.totalPrice;
    let notes = body.notes;

    // If bookingId provided, fetch details from DB
    if (body.bookingId && (!customerEmail || !merchantName)) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data: booking, error } = await supabase
        .from("service_bookings")
        .select(`
          *,
          merchant_services(name),
          merchants(business_name)
        `)
        .eq("id", body.bookingId)
        .single();

      if (error || !booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      customerEmail = customerEmail || booking.customer_email;
      customerName = customerName || booking.customer_name || "Valued Customer";
      merchantName = merchantName || (booking as any).merchants?.business_name || "Your Provider";
      serviceName = serviceName || (booking as any).merchant_services?.name || "Service";
      bookingDate = bookingDate || booking.booking_date;
      startTime = startTime || booking.start_time;
      endTime = endTime || booking.end_time;
      totalPrice = totalPrice ?? booking.total_price;
      notes = notes || booking.notes;
    }

    if (!customerEmail || !bookingDate || !startTime) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const dateFormatted = formatDateReadable(bookingDate!);
    const timeFormatted = formatTime12(startTime!);
    const endTimeFormatted = endTime ? formatTime12(endTime) : "";
    const priceFormatted = totalPrice != null ? `$${(totalPrice / 100).toFixed(2)}` : "";

    let subject = "";
    let htmlContent = "";
    let attachments: Array<{ filename: string; content: string }> = [];

    if (type === "confirmation") {
      subject = `Booking Confirmed – ${serviceName} at ${merchantName}`;
      htmlContent = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#ecfdf5;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">✅</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#065f46;">Booking Confirmed!</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${customerName},</p>
        <p style="color:#374151;line-height:1.6;">Your appointment has been successfully booked. Here are your details:</p>
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Business</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${merchantName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted}${endTimeFormatted ? ` – ${endTimeFormatted}` : ""} PT</td></tr>
            ${priceFormatted ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${priceFormatted}</td></tr>` : ""}
            ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Notes</td><td style="padding:6px 0;color:#111827;text-align:right;">${notes}</td></tr>` : ""}
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">📎 A calendar invite (.ics) is attached — add it to your calendar so you don't forget!</p>
        <p style="color:#6b7280;font-size:14px;">Need to change your plans? You can manage your bookings from <strong>My Bookings</strong> in your PawBucks dashboard.</p>`;

      if (endTime) {
        const ics = generateICS(bookingDate!, startTime!, endTime, `${serviceName} at ${merchantName}`, merchantName!, customerEmail);
        attachments.push({ filename: "appointment.ics", content: btoa(ics) });
      }

    } else if (type === "reminder_24h") {
      subject = `Reminder: ${serviceName} Tomorrow at ${timeFormatted}`;
      htmlContent = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#fef3c7;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">⏰</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#92400e;">Appointment Tomorrow!</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${customerName},</p>
        <p style="color:#374151;line-height:1.6;">Just a friendly reminder — your appointment is <strong>tomorrow</strong>.</p>
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Business</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${merchantName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted} PT</td></tr>
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">Need to cancel or reschedule? Visit <strong>My Bookings</strong> in your dashboard.</p>`;

    } else if (type === "reminder_1h") {
      subject = `Starting Soon: ${serviceName} in 1 Hour`;
      htmlContent = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#dbeafe;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">🔔</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#1e40af;">Your Appointment is in 1 Hour</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${customerName},</p>
        <p style="color:#374151;line-height:1.6;">Your appointment starts <strong>in about 1 hour</strong>. Time to get ready!</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Business</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${merchantName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted} PT</td></tr>
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">We look forward to seeing you! 🐾</p>`;

    } else if (type === "cancellation") {
      subject = `Booking Cancelled – ${serviceName} at ${merchantName}`;
      htmlContent = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#fef2f2;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">❌</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#991b1b;">Booking Cancelled</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${customerName},</p>
        <p style="color:#374151;line-height:1.6;">Your booking has been cancelled.</p>
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;text-decoration:line-through;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;text-decoration:line-through;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;text-decoration:line-through;">${timeFormatted} PT</td></tr>
            ${body.cancellationReason ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Reason</td><td style="padding:6px 0;color:#111827;text-align:right;">${body.cancellationReason}</td></tr>` : ""}
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">You can rebook anytime from the merchant's page or your dashboard.</p>`;

    } else if (type === "rescheduled") {
      subject = `Booking Rescheduled – ${serviceName} at ${merchantName}`;
      htmlContent = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#fefce8;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">📅</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#854d0e;">Booking Rescheduled</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${customerName},</p>
        <p style="color:#374151;line-height:1.6;">Your appointment has been rescheduled.</p>
        ${body.previousDate ? `
        <div style="background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:14px;margin:16px 0;">
          <p style="margin:0;color:#991b1b;font-size:13px;font-weight:600;">Previous Time (Cancelled)</p>
          <p style="margin:4px 0 0;color:#6b7280;text-decoration:line-through;">${formatDateReadable(body.previousDate)} at ${body.previousTime ? formatTime12(body.previousTime) : ""} PT</p>
        </div>` : ""}
        <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:20px;margin:16px 0;">
          <p style="margin:0 0 12px;color:#065f46;font-size:14px;font-weight:600;">✅ New Appointment</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted} PT</td></tr>
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">📎 An updated calendar invite is attached.</p>`;

      if (endTime) {
        const ics = generateICS(bookingDate!, startTime!, endTime, `${serviceName} at ${merchantName}`, merchantName!, customerEmail);
        attachments.push({ filename: "appointment.ics", content: btoa(ics) });
      }
    }

    const emailPayload: any = {
      from: "PawBucks <noreply@pawbucks.app>",
      to: [customerEmail],
      subject,
      html: wrapInBrandedTemplate(htmlContent),
    };
    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const emailResponse = await resend.emails.send(emailPayload);

    if (emailResponse.error) {
      console.error(`Failed to send ${type} booking email:`, emailResponse.error);
      return new Response(JSON.stringify({ success: false, error: emailResponse.error.message }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Booking ${type} email sent to ${customerEmail}`);
    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in send-booking-emails:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
