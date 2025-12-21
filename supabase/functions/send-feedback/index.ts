import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Input validation schema
const feedbackSchema = z.object({
  feedback: z.string().min(1).max(5000).transform(val => val.trim()),
  userEmail: z.string().email().max(255).optional().nullable(),
  userName: z.string().max(100).optional().nullable(),
  userId: z.string().uuid().optional().nullable(),
});

// Priority keywords that trigger urgent admin notification
const PRIORITY_KEYWORDS = ['bug', 'urgent', 'broken', 'error', 'crash', 'not working', 'issue', 'problem', 'help', 'emergency'];

// Sanitize text for safe display in emails (prevent XSS)
function sanitizeForHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .trim();
}

const checkForPriorityKeywords = (text: string): string[] => {
  const lowerText = text.toLowerCase();
  return PRIORITY_KEYWORDS.filter(keyword => lowerText.includes(keyword));
};

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = feedbackSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: "Invalid feedback submission" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    const { feedback, userEmail, userName, userId } = validationResult.data;

    if (feedback.length === 0) {
      return new Response(
        JSON.stringify({ error: "Feedback message is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    // Sanitize inputs for HTML display
    const safeFeedback = sanitizeForHtml(feedback);
    const safeName = userName ? sanitizeForHtml(userName) : null;
    const safeEmail = userEmail ? sanitizeForHtml(userEmail) : null;

    // Check for priority keywords
    const matchedKeywords = checkForPriorityKeywords(feedback);
    const isPriority = matchedKeywords.length > 0;

    console.log("Processing feedback submission:", { 
      feedbackLength: feedback.length,
      hasEmail: !!userEmail, 
      hasName: !!userName, 
      hasUserId: !!userId,
      isPriority,
      matchedKeywords 
    });

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
        feedback: feedback,
        status: "new",
      })
      .select()
      .single();

    if (dbError) {
      console.error("Error saving feedback to database:", dbError);
    } else {
      console.log("Feedback saved to database:", feedbackRecord?.id);
    }

    // Send priority alert if keywords detected
    if (isPriority) {
      try {
        const priorityEmailResponse = await resend.emails.send({
          from: "PawBucks URGENT <noreply@pawbucks.app>",
          to: ["support@pawbucks.app"],
          subject: `🚨 PRIORITY FEEDBACK: ${matchedKeywords.slice(0, 3).join(', ')} detected`,
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="background-color: #dc2626; color: white; padding: 15px; border-radius: 8px 8px 0 0; text-align: center;">
                <h1 style="margin: 0; font-size: 20px;">🚨 PRIORITY FEEDBACK ALERT</h1>
              </div>
              
              <div style="border: 2px solid #dc2626; border-top: none; padding: 20px; border-radius: 0 0 8px 8px;">
                <div style="background-color: #fef2f2; border-left: 4px solid #dc2626; padding: 10px 15px; margin-bottom: 20px;">
                  <p style="margin: 0; color: #991b1b; font-weight: bold;">
                    Keywords detected: ${matchedKeywords.join(', ')}
                  </p>
                </div>
                
                <p><strong>From:</strong> ${safeName || "Anonymous"} ${safeEmail ? `(${safeEmail})` : ""}</p>
                ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
                
                <div style="background-color: #f9fafb; padding: 15px; border-radius: 8px; margin-top: 15px;">
                  <p style="margin: 0 0 10px 0; font-weight: bold; color: #374151;">Feedback Message:</p>
                  <p style="white-space: pre-wrap; margin: 0; color: #1f2937;">${safeFeedback}</p>
                </div>
                
                <p style="margin-top: 20px; padding: 10px; background-color: #fef3c7; border-radius: 4px; color: #92400e; font-size: 14px;">
                  ⚠️ This feedback requires immediate attention. Please review and respond promptly.
                </p>
              </div>
              
              <p style="color: #888; font-size: 12px; text-align: center; margin-top: 20px;">
                This is an automated priority alert from the PawBucks feedback system.
              </p>
            </div>
          `,
        });

        console.log("Priority alert email sent:", priorityEmailResponse);
      } catch (priorityError) {
        console.error("Error sending priority alert email:", priorityError);
      }
    }

    // Send regular notification email to support team
    const supportEmailResponse = await resend.emails.send({
      from: "PawBucks Feedback <noreply@pawbucks.app>",
      to: ["support@pawbucks.app"],
      subject: "New PawBucks User Feedback",
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> ${safeName || "Anonymous"} ${safeEmail ? `(${safeEmail})` : ""}</p>
        ${userId ? `<p><strong>User ID:</strong> ${userId}</p>` : ""}
        <hr />
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${safeFeedback}</p>
        <hr />
        <p style="color: #888; font-size: 12px;">This feedback was submitted through the PawBucks platform.</p>
      `,
    });

    console.log("Support notification email sent:", supportEmailResponse);

    // Send confirmation email to user if they have an email
    if (userEmail && safeEmail) {
      try {
        const truncatedFeedback = safeFeedback.length > 200 
          ? safeFeedback.substring(0, 200) + '...' 
          : safeFeedback;
        
        const confirmationEmailResponse = await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [userEmail],
          subject: "We received your feedback - PawBucks",
          html: `
            <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <div style="text-align: center; margin-bottom: 30px;">
                <h1 style="color: #f59e0b; margin: 0;">🐾 PawBucks</h1>
              </div>
              
              <h2 style="color: #333;">Thank you for your feedback${safeName ? `, ${sanitizeForHtml(safeName.split(' ')[0])}` : ''}!</h2>
              
              <p style="color: #555; line-height: 1.6;">
                We've received your message and truly appreciate you taking the time to share your thoughts with us. 
                Your feedback helps us improve PawBucks for all pet parents and merchants.
              </p>
              
              <div style="background-color: #f9fafb; border-left: 4px solid #f59e0b; padding: 15px; margin: 20px 0;">
                <p style="margin: 0; color: #666; font-style: italic;">"${truncatedFeedback}"</p>
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
  } catch (error) {
    console.error("Error processing feedback:", error);
    return new Response(
      JSON.stringify({ error: "Unable to submit feedback. Please try again." }),
      {
        status: 500,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      }
    );
  }
};

serve(handler);
