import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface ConfirmationRequest {
  recipientEmail: string;
  recipientName?: string;
  bookingDate: string;
  timeSlot: string;
  notes?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { recipientEmail, recipientName, bookingDate, timeSlot, notes }: ConfirmationRequest = await req.json();

    if (!recipientEmail || !bookingDate || !timeSlot) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Sending consultation confirmation email:", { recipientEmail, bookingDate, timeSlot });

    const emailResponse = await resend.emails.send({
      from: "PawBucks Consultations <onboarding@resend.dev>",
      to: [recipientEmail],
      subject: "Your PawBucks Consultation is Confirmed!",
      html: `
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
              Hi${recipientName ? ` ${recipientName}` : ''},
            </p>
            
            <p style="font-size: 16px; margin-bottom: 20px;">
              Great news! Your free consultation with PawBucks has been confirmed.
            </p>
            
            <div style="background: white; border: 2px solid #667eea; border-radius: 8px; padding: 20px; margin: 20px 0;">
              <h2 style="color: #667eea; margin: 0 0 15px 0; font-size: 18px;">📅 Meeting Details</h2>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 80px;"><strong>Date:</strong></td>
                  <td style="padding: 8px 0;">${bookingDate}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Time:</strong></td>
                  <td style="padding: 8px 0;">${timeSlot} Pacific Time</td>
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
            
            ${notes ? `
            <div style="background: #fef3c7; border-radius: 8px; padding: 15px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px;"><strong>Your Notes:</strong> ${notes}</p>
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
      `,
    });

    console.log("Confirmation email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending confirmation email:", error);
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
