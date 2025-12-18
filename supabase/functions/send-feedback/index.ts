import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface FeedbackRequest {
  feedback: string;
  userEmail?: string;
  userName?: string;
  userId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedback, userEmail, userName, userId }: FeedbackRequest = await req.json();

    if (!feedback || feedback.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Feedback message is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Processing feedback submission:", { feedback, userEmail, userName, userId });

    // Initialize Supabase client with service role
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Save feedback to database
    const { data: feedbackRecord, error: dbError } = await supabase
      .from("feedback_submissions")
      .insert({
        user_id: userId || null,
        user_email: userEmail || null,
        user_name: userName || null,
        feedback: feedback.trim(),
        status: "new",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving feedback to database:", dbError);
      // Continue to send email even if db save fails
    } else {
      console.log("Feedback saved to database:", feedbackRecord?.id);
    }

    // Send notification email to support team
    const supportEmailResponse = await resend.emails.send({
      from: "PawBucks Feedback <noreply@pawbucks.app>",
      to: ["support@pawbucks.app"],
      subject: "New PawBucks User Feedback",
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> ${userName || "Anonymous"} ${userEmail ? `(${userEmail})` : ""}</p>
        ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
        <hr />
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${feedback}</p>
        <hr />
        <p style="color: #888; font-size: 12px;">This feedback was submitted through the PawBucks platform.</p>
      `,
    });

    console.log("Support notification email sent:", supportEmailResponse);

    // Send confirmation email to user if they have an email
    if (userEmail) {
      try {
        const confirmationEmailResponse = await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [userEmail],
          subject: "We received your feedback - PawBucks",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #f59e0b; margin: 0;">🐾 PawBucks</h1>
              </div>
              
              <h2 style="color: #333;">Thank you for your feedback${userName ? `, ${userName.split(' ')[0]}` : ''}!</h2>
              
              <p style="color: #555; line-height: 1.6;">
                We've received your message and truly appreciate you taking the time to share your thoughts with us. 
                Your feedback helps us improve PawBucks for all pet parents and merchants.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #666; font-style: italic;">"${feedback.length > 200 ? feedback.substring(0, 200) + '...' : feedback}"</p>
              </div>
              
              <p style="color: #555; line-height: 1.6;">
                Our team reviews all feedback and will reach out if we need any additional information.
              </p>
              
              <p style="color: #555; line-height: 1.6;">
                Thanks for being part of the PawBucks community!
              </p>
              
              <p style="color: #555;">
                Best regards,<br/>
                <strong>The PawBucks Team</strong>
              </p>
              
              <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
              
              <p style="color: #999; font-size: 12px; text-align: center;">
                This is an automated confirmation email. Please do not reply directly to this message.
              </p>
            </div>
          `,
        });

        console.log("Confirmation email sent to user:", confirmationEmailResponse);
      } catch (confirmError) {
        console.error("Error sending confirmation email to user:", confirmError);
        // Don't fail the request if confirmation email fails
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error processing feedback:", error);
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
