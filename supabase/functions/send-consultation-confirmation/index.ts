import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface NotificationRequest {
  type: "confirmed" | "cancelled" | "rescheduled";
  recipientEmail: string;
  recipientName?: string;
  bookingDate: string; // Formatted date for display
  bookingDateRaw: string; // yyyy-MM-dd format for ICS
  timeSlot: string;
  notes?: string;
  previousDate?: string;
  previousTimeSlot?: string;
}

// Parse time slot like "9:00 AM" or "1:30 PM" to hours and minutes
function parseTimeSlot(timeSlot: string): { hours: number; minutes: number } {
  const match = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) {
    return { hours: 9, minutes: 0 }; // Default fallback
  }
  
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3].toUpperCase();
  
  if (period === "PM" && hours !== 12) {
    hours += 12;
  } else if (period === "AM" && hours === 12) {
    hours = 0;
  }
  
  return { hours, minutes };
}

// Format date for ICS (YYYYMMDDTHHMMSS format)
function formatICSDate(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  const hours = String(date.getUTCHours()).padStart(2, "0");
  const minutes = String(date.getUTCMinutes()).padStart(2, "0");
  const seconds = String(date.getUTCSeconds()).padStart(2, "0");
  return `${year}${month}${day}T${hours}${minutes}${seconds}Z`;
}

// Generate ICS calendar content
function generateICSContent(data: NotificationRequest): string {
  const { hours, minutes } = parseTimeSlot(data.timeSlot);
  
  // Parse the raw date (yyyy-MM-dd)
  const [year, month, day] = data.bookingDateRaw.split("-").map(Number);
  
  // Create date in Pacific Time (PT is UTC-8 or UTC-7 depending on DST)
  // For simplicity, we'll use a fixed offset approach
  // Pacific Time: Add 8 hours to convert to UTC (or 7 during DST)
  const startDate = new Date(Date.UTC(year, month - 1, day, hours + 8, minutes, 0));
  const endDate = new Date(startDate.getTime() + 15 * 60 * 1000); // 15 minutes later
  
  const now = new Date();
  const uid = `pawbucks-consultation-${data.bookingDateRaw}-${Date.now()}@pawbucks.app`;
  
  const icsContent = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//PawBucks//Consultation Booking//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:REQUEST",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${formatICSDate(now)}`,
    `DTSTART:${formatICSDate(startDate)}`,
    `DTEND:${formatICSDate(endDate)}`,
    "SUMMARY:PawBucks Free Consultation",
    `DESCRIPTION:Your free 15-minute consultation with PawBucks.${data.notes ? `\\n\\nYour notes: ${data.notes.replace(/\n/g, "\\n")}` : ""}\\n\\nContact: jfields@pawbucks.app`,
    "LOCATION:Video Call (link will be sent separately)",
    "STATUS:CONFIRMED",
    `ORGANIZER;CN=PawBucks:mailto:jfields@pawbucks.app`,
    `ATTENDEE;CN=${data.recipientName || "Guest"};RSVP=TRUE:mailto:${data.recipientEmail}`,
    "BEGIN:VALARM",
    "TRIGGER:-PT30M",
    "ACTION:DISPLAY",
    "DESCRIPTION:PawBucks Consultation in 30 minutes",
    "END:VALARM",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:PawBucks Consultation in 10 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  
  return icsContent;
}

const getConfirmedEmailHtml = (data: NotificationRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">✅ Consultation Confirmed!</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi${data.recipientName ? ` ${data.recipientName}` : ''},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Great news! Your free consultation with PawBucks has been confirmed.
    </p>
    
    <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">📅 Meeting Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 80px;"><strong>Date:</strong></td>
          <td style="padding: 8px 0;">${data.bookingDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td>
          <td style="padding: 8px 0;">${data.timeSlot} Pacific Time</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Duration:</strong></td>
          <td style="padding: 8px 0;">15 minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Format:</strong></td>
          <td style="padding: 8px 0;">Video Call (link will be sent separately)</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #1e40af;">
        📎 <strong>Calendar invite attached!</strong> Open the .ics file to add this event to your calendar.
      </p>
    </div>
    
    ${data.notes ? `
    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Your Notes:</strong> ${data.notes}</p>
    </div>
    ` : ''}
    
    <div style="background: #ecfdf5; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <h3 style="color: #059669; margin: 0 0 10px 0; font-size: 16px;">📝 What to Prepare</h3>
      <ul style="margin: 0; padding-left: 20px; color: #065f46;">
        <li>Questions about the PawBucks platform</li>
        <li>Information about your business</li>
        <li>Any specific topics you'd like to discuss</li>
      </ul>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If you need to reschedule or have any questions, please reply to this email or contact us at <a href="mailto:jfields@pawbucks.app" style="color: #667eea;">jfields@pawbucks.app</a>.
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      Looking forward to speaking with you!
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      Best regards,<br>
      <strong>The PawBucks Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
  </div>
</body>
</html>
`;

const getCancelledEmailHtml = (data: NotificationRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">❌ Consultation Cancelled</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi${data.recipientName ? ` ${data.recipientName}` : ''},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      We regret to inform you that your consultation has been cancelled.
    </p>
    
    <div style="background: white; border: 2px solid #ef4444; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #ef4444; margin: 0 0 15px 0; font-size: 18px;">📅 Cancelled Appointment</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 80px;"><strong>Date:</strong></td>
          <td style="padding: 8px 0; text-decoration: line-through;">${data.bookingDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td>
          <td style="padding: 8px 0; text-decoration: line-through;">${data.timeSlot} Pacific Time</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;">
        <strong>Want to reschedule?</strong> You can book a new consultation at any time through the PawBucks platform.
      </p>
    </div>
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If you have any questions or would like to schedule a new consultation, please contact us at <a href="mailto:jfields@pawbucks.app" style="color: #667eea;">jfields@pawbucks.app</a>.
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      We apologize for any inconvenience.
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      Best regards,<br>
      <strong>The PawBucks Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
  </div>
</body>
</html>
`;

const getRescheduledEmailHtml = (data: NotificationRequest) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
  <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 30px; border-radius: 12px 12px 0 0; text-align: center;">
    <h1 style="color: white; margin: 0; font-size: 28px;">🔄 Consultation Rescheduled</h1>
  </div>
  
  <div style="background: #f9fafb; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
    <p style="font-size: 16px; margin-bottom: 20px;">
      Hi${data.recipientName ? ` ${data.recipientName}` : ''},
    </p>
    
    <p style="font-size: 16px; margin-bottom: 20px;">
      Your consultation with PawBucks has been rescheduled to a new date and time.
    </p>
    
    ${data.previousDate && data.previousTimeSlot ? `
    <div style="background: #fee2e2; border: 1px solid #fecaca; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <h3 style="color: #dc2626; margin: 0 0 10px 0; font-size: 14px;">❌ Previous Appointment (Cancelled)</h3>
      <p style="margin: 0; text-decoration: line-through; color: #666;">
        ${data.previousDate} at ${data.previousTimeSlot} PT
      </p>
    </div>
    ` : ''}
    
    <div style="background: white; border: 2px solid #10b981; border-radius: 8px; padding: 20px; margin: 20px 0;">
      <h2 style="color: #10b981; margin: 0 0 15px 0; font-size: 18px;">✅ New Meeting Details</h2>
      <table style="width: 100%; border-collapse: collapse;">
        <tr>
          <td style="padding: 8px 0; color: #666; width: 80px;"><strong>Date:</strong></td>
          <td style="padding: 8px 0; font-weight: bold;">${data.bookingDate}</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td>
          <td style="padding: 8px 0; font-weight: bold;">${data.timeSlot} Pacific Time</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Duration:</strong></td>
          <td style="padding: 8px 0;">15 minutes</td>
        </tr>
        <tr>
          <td style="padding: 8px 0; color: #666;"><strong>Format:</strong></td>
          <td style="padding: 8px 0;">Video Call (link will be sent separately)</td>
        </tr>
      </table>
    </div>
    
    <div style="background: #dbeafe; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px; color: #1e40af;">
        📎 <strong>Updated calendar invite attached!</strong> Open the .ics file to update your calendar.
      </p>
    </div>
    
    ${data.notes ? `
    <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
      <p style="margin: 0; font-size: 14px;"><strong>Your Notes:</strong> ${data.notes}</p>
    </div>
    ` : ''}
    
    <p style="font-size: 14px; color: #666; margin-top: 30px;">
      If this new time doesn't work for you, please contact us at <a href="mailto:jfields@pawbucks.app" style="color: #667eea;">jfields@pawbucks.app</a> to arrange an alternative.
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      Looking forward to speaking with you!
    </p>
    
    <p style="font-size: 16px; margin-top: 20px;">
      Best regards,<br>
      <strong>The PawBucks Team</strong>
    </p>
  </div>
  
  <div style="text-align: center; padding: 20px; color: #9ca3af; font-size: 12px;">
    <p>© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
  </div>
</body>
</html>
`;

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const data: NotificationRequest = await req.json();

    if (!data.recipientEmail || !data.bookingDate || !data.timeSlot || !data.type) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log(`Sending ${data.type} consultation email:`, { recipientEmail: data.recipientEmail, bookingDate: data.bookingDate, timeSlot: data.timeSlot });

    let subject: string;
    let html: string;
    let attachments: { filename: string; content: string }[] | undefined;

    switch (data.type) {
      case "confirmed":
        subject = "Your PawBucks Consultation is Confirmed!";
        html = getConfirmedEmailHtml(data);
        if (data.bookingDateRaw) {
          const icsContent = generateICSContent(data);
          attachments = [{
            filename: "pawbucks-consultation.ics",
            content: btoa(icsContent),
          }];
        }
        break;
      case "cancelled":
        subject = "Your PawBucks Consultation Has Been Cancelled";
        html = getCancelledEmailHtml(data);
        break;
      case "rescheduled":
        subject = "Your PawBucks Consultation Has Been Rescheduled";
        html = getRescheduledEmailHtml(data);
        if (data.bookingDateRaw) {
          const icsContent = generateICSContent(data);
          attachments = [{
            filename: "pawbucks-consultation-updated.ics",
            content: btoa(icsContent),
          }];
        }
        break;
      default:
        return new Response(
          JSON.stringify({ error: "Invalid notification type" }),
          {
            status: 400,
            headers: { "Content-Type": "application/json", ...corsHeaders },
          }
        );
    }

    const emailResponse = await resend.emails.send({
      from: "PawBucks Consultations <onboarding@resend.dev>",
      to: [data.recipientEmail],
      subject,
      html,
      attachments,
    });

    console.log(`${data.type} email sent successfully:`, emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending consultation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
