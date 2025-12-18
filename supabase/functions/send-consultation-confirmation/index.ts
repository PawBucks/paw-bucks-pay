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
  bookingDate: string;
  bookingDateRaw?: string;
  timeSlot: string;
  notes?: string;
  previousDate?: string;
  previousTimeSlot?: string;
}

// Helper function to parse time slot to hour and minute
const parseTimeSlot = (timeSlot: string): { hour: number; minute: number } => {
  const match = timeSlot.match(/(\d{1,2}):(\d{2})\s*(AM|PM)/i);
  if (!match) return { hour: 9, minute: 0 };
  
  let hour = parseInt(match[1]);
  const minute = parseInt(match[2]);
  const period = match[3].toUpperCase();
  
  if (period === "PM" && hour !== 12) hour += 12;
  if (period === "AM" && hour === 12) hour = 0;
  
  return { hour, minute };
};

// Format date for ICS (UTC format)
const formatICSDate = (dateStr: string, hour: number, minute: number): string => {
  // dateStr is in YYYY-MM-DD format, hour/minute are in Pacific Time
  const date = new Date(`${dateStr}T00:00:00`);
  
  // Pacific Time offset (roughly -8 or -7 depending on DST)
  // For simplicity, we'll add 8 hours to convert PT to UTC
  const utcHour = hour + 8;
  
  date.setUTCHours(utcHour, minute, 0, 0);
  
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  
  return `${year}${month}${day}T${hours}${minutes}00Z`;
};

// Generate ICS content for calendar invite
const generateICSContent = (bookingDateRaw: string, timeSlot: string, recipientEmail: string): string => {
  const { hour, minute } = parseTimeSlot(timeSlot);
  const startTime = formatICSDate(bookingDateRaw, hour, minute);
  
  // End time is 15 minutes later
  const endHour = minute + 15 >= 60 ? hour + 1 : hour;
  const endMinute = (minute + 15) % 60;
  const endTime = formatICSDate(bookingDateRaw, endHour, endMinute);
  
  const uid = `pawbucks-consultation-${Date.now()}@pawbucks.app`;
  const now = new Date().toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PawBucks//Consultation//EN
CALSCALE:GREGORIAN
METHOD:REQUEST
BEGIN:VEVENT
UID:${uid}
DTSTAMP:${now}
DTSTART:${startTime}
DTEND:${endTime}
SUMMARY:PawBucks Consultation
DESCRIPTION:Your consultation with the PawBucks merchant success team.
LOCATION:Video Call (link will be provided)
ORGANIZER:mailto:jfields@pawbucks.app
ATTENDEE:mailto:${recipientEmail}
STATUS:CONFIRMED
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder: PawBucks Consultation in 30 minutes
TRIGGER:-PT30M
END:VALARM
BEGIN:VALARM
ACTION:DISPLAY
DESCRIPTION:Reminder: PawBucks Consultation in 10 minutes
TRIGGER:-PT10M
END:VALARM
END:VEVENT
END:VCALENDAR`;
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type, recipientEmail, bookingDate, bookingDateRaw, timeSlot, notes, previousDate, previousTimeSlot }: NotificationRequest = await req.json();

    if (!recipientEmail || !bookingDate || !timeSlot) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`Sending ${type} consultation email:`, { recipientEmail, bookingDate, timeSlot });

    let subject = "";
    let html = "";
    let attachments: Array<{ filename: string; content: string }> = [];

    if (type === "confirmed") {
      subject = "Your PawBucks Consultation is Confirmed!";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #4F46E5; margin: 0;">Consultation Confirmed!</h1>
          </div>
          
          <p>Great news! Your consultation with the PawBucks merchant success team has been confirmed.</p>
          
          <div style="background: #F3F4F6; border-radius: 12px; padding: 20px; margin: 20px 0;">
            <h3 style="margin: 0 0 15px 0; color: #374151;">📅 Appointment Details</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timeSlot} Pacific Time</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> 15 minutes</p>
            ${notes ? `<p style="margin: 5px 0;"><strong>Notes:</strong> ${notes}</p>` : ""}
          </div>
          
          <p style="color: #6B7280; font-size: 14px;">A calendar invite is attached. You'll receive a video call link before your appointment.</p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">PawBucks - Rewards for Pet Parents</p>
        </div>
      `;
      
      // Add calendar invite attachment for confirmed bookings
      if (bookingDateRaw) {
        const icsContent = generateICSContent(bookingDateRaw, timeSlot, recipientEmail);
        attachments.push({
          filename: "consultation.ics",
          content: btoa(icsContent),
        });
      }
    } else if (type === "cancelled") {
      subject = "Your PawBucks Consultation Has Been Cancelled";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #DC2626; margin: 0;">Consultation Cancelled</h1>
          </div>
          
          <p>Your scheduled consultation has been cancelled.</p>
          
          <div style="background: #FEF2F2; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #FECACA;">
            <h3 style="margin: 0 0 15px 0; color: #991B1B;">❌ Cancelled Appointment</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timeSlot} Pacific Time</p>
          </div>
          
          <p>If you'd like to reschedule, please visit your merchant dashboard to book a new time.</p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">PawBucks - Rewards for Pet Parents</p>
        </div>
      `;
    } else if (type === "rescheduled") {
      subject = "Your PawBucks Consultation Has Been Rescheduled";
      html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #F59E0B; margin: 0;">Consultation Rescheduled</h1>
          </div>
          
          <p>Your consultation has been rescheduled to a new time.</p>
          
          ${previousDate && previousTimeSlot ? `
          <div style="background: #FEF2F2; border-radius: 12px; padding: 15px; margin: 20px 0; border: 1px solid #FECACA;">
            <h4 style="margin: 0 0 10px 0; color: #991B1B;">❌ Previous Time</h4>
            <p style="margin: 5px 0; text-decoration: line-through; color: #6B7280;">${previousDate} at ${previousTimeSlot} PT</p>
          </div>
          ` : ""}
          
          <div style="background: #ECFDF5; border-radius: 12px; padding: 20px; margin: 20px 0; border: 1px solid #A7F3D0;">
            <h3 style="margin: 0 0 15px 0; color: #065F46;">✅ New Appointment</h3>
            <p style="margin: 5px 0;"><strong>Date:</strong> ${bookingDate}</p>
            <p style="margin: 5px 0;"><strong>Time:</strong> ${timeSlot} Pacific Time</p>
            <p style="margin: 5px 0;"><strong>Duration:</strong> 15 minutes</p>
          </div>
          
          <p style="color: #6B7280; font-size: 14px;">An updated calendar invite is attached.</p>
          
          <hr style="border: none; border-top: 1px solid #E5E7EB; margin: 30px 0;" />
          <p style="color: #9CA3AF; font-size: 12px; text-align: center;">PawBucks - Rewards for Pet Parents</p>
        </div>
      `;
      
      // Add calendar invite attachment for rescheduled bookings
      if (bookingDateRaw) {
        const icsContent = generateICSContent(bookingDateRaw, timeSlot, recipientEmail);
        attachments.push({
          filename: "consultation.ics",
          content: btoa(icsContent),
        });
      }
    }

    const emailPayload: any = {
      from: "PawBucks <onboarding@resend.dev>",
      to: [recipientEmail],
      subject,
      html,
    };

    if (attachments.length > 0) {
      emailPayload.attachments = attachments;
    }

    const emailResponse = await resend.emails.send(emailPayload);

    // Check for errors in the response
    if (emailResponse.error) {
      console.error(`Failed to send ${type} email:`, emailResponse.error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: emailResponse.error.message,
          hint: emailResponse.error.message.includes("verify a domain") 
            ? "Please verify your domain at resend.com/domains to send emails to external recipients."
            : undefined
        }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`${type} email sent successfully:`, emailResponse);

    return new Response(JSON.stringify({ success: true, data: emailResponse.data }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending consultation email:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
