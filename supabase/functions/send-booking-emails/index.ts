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

// HTML-escape user-controlled values before interpolating into email templates
// so that names, notes, and other free-text fields cannot inject markup or
// scripts into the branded email body.
const escapeHtml = (v: unknown): string => {
  if (v === null || v === undefined) return "";
  return String(v).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[c] as string));
};

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
    // ---- AuthZ --------------------------------------------------------------
    // This function can send PawBucks-branded emails with attacker-controlled
    // HTML if left open. Accept either an internal cron/edge-function caller
    // (via the shared secret) or an authenticated user tied to the booking.
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const providedInternal = req.headers.get("x-internal-secret");
    const isInternal = !!(providedInternal && internalSecret && providedInternal === internalSecret);

    let callerId: string | null = null;
    if (!isInternal) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: claimsRes, error: claimsErr } = await supabase.auth.getClaims(token);
      callerId = claimsRes?.claims?.sub ?? null;
      if (claimsErr || !callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const body: BookingEmailRequest = await req.json();
    let { type } = body;
    // Normalize legacy alias
    if ((type as string) === "reschedule") type = "rescheduled";
    const initiator = body.initiator || "customer";

    // Non-internal callers must reference an existing booking so the recipient
    // and content fields are re-resolved from the database rather than trusted
    // from the request body.
    if (!isInternal && !body.bookingId) {
      return new Response(JSON.stringify({ error: "bookingId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let customerEmail = body.customerEmail;
    let customerName = body.customerName;
    let merchantName = body.merchantName;
    let serviceName = body.serviceName;
    let bookingDate = body.bookingDate;
    let startTime = body.startTime;
    let endTime = body.endTime;
    let totalPrice = body.totalPrice;
    let notes = body.notes;

    let merchantEmail: string | null = null;
    let merchantOwnerUserId: string | null = null;
    let customerUserId: string | null = null;
    let merchantId: string | null = null;
    let serviceId: string | null = null;
    let petName: string | null = null;

    if (body.bookingId) {
      const { data: booking, error } = await supabase
        .from("service_bookings")
        .select(`
          *,
          merchant_services(name, merchant_id),
          merchants(id, business_name, email, user_id)
        `)
        .eq("id", body.bookingId)
        .single();

      if (error || !booking) {
        return new Response(JSON.stringify({ error: "Booking not found" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Always trust DB values for the recipient/content fields when a booking
      // is referenced; only allow body overrides for internal callers.
      customerEmail = isInternal ? (customerEmail || booking.customer_email) : booking.customer_email;
      customerName = isInternal
        ? (customerName || booking.customer_name || "Valued Customer")
        : (booking.customer_name || "Valued Customer");
      merchantName = (booking as any).merchants?.business_name || "Your Provider";
      serviceName = (booking as any).merchant_services?.name || "Service";
      bookingDate = booking.booking_date;
      startTime = booking.start_time;
      endTime = booking.end_time;
      totalPrice = booking.total_price;
      notes = booking.notes;
      merchantEmail = (booking as any).merchants?.email || null;
      merchantOwnerUserId = (booking as any).merchants?.user_id || null;
      merchantId = (booking as any).merchants?.id || null;
      customerUserId = booking.user_id || null;
      serviceId = booking.service_id || null;

      if (booking.pet_id) {
        const { data: pet } = await supabase
          .from("pet_profiles")
          .select("name")
          .eq("id", booking.pet_id)
          .maybeSingle();
        petName = pet?.name || null;
      }

      // Ownership check: non-internal callers must be the customer, the
      // merchant owner, or a platform admin/superadmin.
      if (!isInternal) {
        let allowed = callerId === customerUserId || callerId === merchantOwnerUserId;
        if (!allowed) {
          const { data: roles } = await supabase
            .from("user_roles")
            .select("role")
            .eq("user_id", callerId!);
          allowed = !!roles?.some((r: { role: string }) => r.role === "admin" || r.role === "superadmin");
        }
        if (!allowed) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }
    }

    if (!customerEmail || !bookingDate || !startTime) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Escape all free-text values before templating them into the email body.
    customerName = escapeHtml(customerName);
    merchantName = escapeHtml(merchantName);
    serviceName = escapeHtml(serviceName);
    notes = notes ? escapeHtml(notes) : notes;
    const cancellationReasonSafe = body.cancellationReason ? escapeHtml(body.cancellationReason) : "";

    const dateFormatted = formatDateReadable(bookingDate!);
    const timeFormatted = formatTime12(startTime!);
    const endTimeFormatted = endTime ? formatTime12(endTime) : "";
    // service_bookings.total_price and merchant_services.price are stored in
    // USD, not cents. Dividing here turned an $80 booking into $0.80.
    const numericTotalPrice = totalPrice == null ? null : Number(totalPrice);
    const priceFormatted = numericTotalPrice != null && Number.isFinite(numericTotalPrice)
      ? `$${numericTotalPrice.toFixed(2)}`
      : "";

    let subject = "";
    let htmlContent = "";
    let attachments: Array<{ filename: string; content: string }> = [];

    if (type === "confirmation" && initiator === "customer") {
      // Customer just requested the booking — not confirmed yet.
      subject = `Booking Request Received – ${serviceName} at ${merchantName}`;
      htmlContent = `
        <div style="text-align:center;margin-bottom:24px;">
          <div style="display:inline-block;background:#eff6ff;border-radius:50%;padding:16px;margin-bottom:12px;">
            <span style="font-size:32px;">📩</span>
          </div>
          <h1 style="margin:0;font-size:24px;color:#1e40af;">Booking Request Received!</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${customerName},</p>
        <p style="color:#374151;line-height:1.6;">We've sent your booking request to <strong>${merchantName}</strong>. You'll get a confirmation email as soon as they accept it. Here are your requested details:</p>
        <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:12px;padding:20px;margin:24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Business</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${merchantName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted}${endTimeFormatted ? ` – ${endTimeFormatted}` : ""} PT</td></tr>
            ${priceFormatted ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${priceFormatted}</td></tr>` : ""}
            ${notes ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Notes</td><td style="padding:6px 0;color:#111827;text-align:right;">${notes}</td></tr>` : ""}
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">You can track the status of your request from <strong>My Bookings</strong> in your PawBucks dashboard.</p>`;

    } else if (type === "confirmation") {
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
        attachments.push({ filename: "appointment.ics", content: utf8ToBase64(ics) });
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
            ${cancellationReasonSafe ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Reason</td><td style="padding:6px 0;color:#111827;text-align:right;">${cancellationReasonSafe}</td></tr>` : ""}
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
        attachments.push({ filename: "appointment.ics", content: utf8ToBase64(ics) });
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

    const failures: string[] = [];
    let emailResponse: any = { data: null, error: null };
    try {
      emailResponse = await resend.emails.send(emailPayload);
    } catch (e) {
      emailResponse = { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
    }
    if (emailResponse.error) {
      console.error(`Failed to send ${type} booking email:`, emailResponse.error);
      failures.push(`Customer email failed: ${emailResponse.error.message}`);
    } else {
      console.log(`Booking ${type} email sent to ${customerEmail}`);
    }

    // Fall back to the business owner's account email when no business email is saved.
    if (!merchantEmail && merchantOwnerUserId) {
      const { data: owner } = await supabase
        .from("profiles").select("email").eq("id", merchantOwnerUserId).maybeSingle();
      merchantEmail = (owner as any)?.email || null;
    }

    // ----- Merchant-facing notifications + in-app notifications (best-effort) -----
    // Customer links: a new request (initiator customer) routes to the booking
    // detail page; a merchant approval routes to My Bookings focused on it.
    // Cancellations route to the booking detail page.
    const customerLinkUrl =
      type === "confirmation"
        ? initiator === "merchant"
          ? `/my-bookings?booking=${body.bookingId}`
          : `/bookings/${body.bookingId}`
        : body.bookingId
          ? `/bookings/${body.bookingId}`
          : "/my-bookings";
    const merchantLinkUrl = body.bookingId ? `/bookings/${body.bookingId}` : "/my-bookings";

    const titles: Record<typeof type, { customer: string; merchant: string }> = {
      confirmation: {
        customer: initiator === "merchant" ? "Booking confirmed" : "Booking requested",
        merchant: "📋 New booking request",
      },
      cancellation: {
        customer: "Booking cancelled",
        merchant:
          initiator === "customer"
            ? "❌ Customer cancelled a booking"
            : "❌ Booking cancelled",
      },
      rescheduled: {
        customer: "📅 Booking rescheduled",
        merchant:
          initiator === "customer"
            ? "📅 Customer requested a reschedule"
            : "📅 Booking rescheduled",
      },
      reminder_24h: { customer: "⏰ Appointment tomorrow", merchant: "" },
      reminder_1h: { customer: "🔔 Appointment in 1 hour", merchant: "" },
      reschedule: { customer: "", merchant: "" },
    };

    const summary = `${serviceName} · ${dateFormatted} · ${timeFormatted}${endTimeFormatted ? ` – ${endTimeFormatted}` : ""}`;
    const customerLabel = customerName || "A customer";
    const petLabel = petName ? ` for ${petName}` : "";

    // Insert in-app notifications for both parties (skip silent reminder types for merchant)
    try {
      const rows: Array<{
        user_id: string;
        title: string;
        message: string;
        category: string;
        is_read: boolean;
        link_url: string | null;
      }> = [];

      if (customerUserId && titles[type].customer) {
        rows.push({
          user_id: customerUserId,
          title: titles[type].customer,
          message: `${serviceName}${petLabel} at ${merchantName} · ${dateFormatted} · ${timeFormatted}${endTimeFormatted ? ` – ${endTimeFormatted}` : ""}`,
          category: "transactional",
          is_read: false,
          link_url: customerLinkUrl,
        });
      }
      if (
        merchantOwnerUserId &&
        titles[type].merchant &&
        type !== "reminder_24h" &&
        type !== "reminder_1h"
      ) {
        rows.push({
          user_id: merchantOwnerUserId,
          title: titles[type].merchant,
          message: `${customerLabel} · ${summary}`,
          category: "transactional",
          is_read: false,
          link_url: merchantLinkUrl,
        });
      }
      if (rows.length) {
        const { error: notifErr } = await supabase.from("notifications").insert(rows);
        if (notifErr) console.error("In-app notification insert failed:", notifErr);
      }
    } catch (e) {
      console.error("In-app notification block failed:", e);
    }

    // Send merchant email (only for booking lifecycle events, not reminders)
    const merchantEmailRequired =
      type === "confirmation" || type === "cancellation" || type === "rescheduled";
    if (merchantEmailRequired && !merchantEmail && body.bookingId) {
      failures.push("Business email failed: no email address on file for this business");
    }
    if (merchantEmail && merchantEmailRequired) {
      const merchantTitle =
        type === "confirmation"
          ? "📋 New Booking Request"
          : type === "cancellation"
          ? initiator === "customer"
            ? "❌ Customer Cancelled a Booking"
            : "Booking Cancelled"
          : initiator === "customer"
          ? "📅 Customer Requested a Reschedule"
          : "Booking Rescheduled";

      const merchantHtml = `
        <div style="text-align:center;margin-bottom:20px;">
          <h1 style="margin:0;font-size:22px;color:#111827;">${merchantTitle}</h1>
        </div>
        <p style="color:#374151;line-height:1.6;">Hi ${merchantName},</p>
        <p style="color:#374151;line-height:1.6;">
          ${
            type === "confirmation"
              ? `${customerLabel} just requested a booking. Please review and confirm in your dashboard.`
              : type === "cancellation"
              ? `${customerLabel}'s booking has been cancelled${cancellationReasonSafe ? `: <em>${cancellationReasonSafe}</em>` : "."}`
              : `${customerLabel} rescheduled their appointment. The new time is below.`
          }
        </p>
        <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:20px;margin:20px 0;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Customer</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${customerLabel}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Service</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${serviceName}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Date</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${dateFormatted}</td></tr>
            <tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Time</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${timeFormatted}${endTimeFormatted ? ` – ${endTimeFormatted}` : ""} PT</td></tr>
            ${priceFormatted ? `<tr><td style="padding:6px 0;color:#6b7280;font-size:14px;">Price</td><td style="padding:6px 0;font-weight:600;color:#111827;text-align:right;">${priceFormatted}</td></tr>` : ""}
          </table>
        </div>
        <p style="color:#6b7280;font-size:14px;">
          <a href="https://pawbucks.app${merchantLinkUrl}" style="color:#0d9488;text-decoration:none;font-weight:600;">View in dashboard →</a>
        </p>`;

      try {
        const merchantResponse = await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [merchantEmail],
          subject: `${merchantTitle} – ${serviceName}`,
          html: wrapInBrandedTemplate(merchantHtml),
        });
        if (merchantResponse.error) {
          console.error("Failed to send merchant email:", merchantResponse.error);
          failures.push(`Business email failed: ${merchantResponse.error.message}`);
        } else {
          console.log(`Merchant ${type} email sent to ${merchantEmail}`);
        }
      } catch (e) {
        console.error("Merchant email send threw:", e);
        failures.push(`Business email failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }

    if (failures.length > 0) {
      return new Response(JSON.stringify({ success: false, error: failures.join("; "), failures }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

function utf8ToBase64(s: string): string {
  const bytes = new TextEncoder().encode(s);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}
