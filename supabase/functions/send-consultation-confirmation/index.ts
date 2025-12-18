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
  bookingDate: string;
  timeSlot: string;
  notes?: string;
  previousDate?: string;
  previousTimeSlot?: string;
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

    switch (data.type) {
      case "confirmed":
        subject = "Your PawBucks Consultation is Confirmed!";
        html = getConfirmedEmailHtml(data);
        break;
      case "cancelled":
        subject = "Your PawBucks Consultation Has Been Cancelled";
        html = getCancelledEmailHtml(data);
        break;
      case "rescheduled":
        subject = "Your PawBucks Consultation Has Been Rescheduled";
        html = getRescheduledEmailHtml(data);
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
