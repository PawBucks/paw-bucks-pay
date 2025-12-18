import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { Resend } from "npm:resend@2.0.0";

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
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { feedback, userEmail, userName }: FeedbackRequest = await req.json();

    if (!feedback || feedback.trim().length === 0) {
      return new Response(
        JSON.stringify({ error: "Feedback message is required" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json", ...corsHeaders },
        }
      );
    }

    console.log("Sending feedback email:", { feedback, userEmail, userName });

    const emailResponse = await resend.emails.send({
      from: "PawBucks Feedback <onboarding@resend.dev>",
      to: ["admin@pawbucks.app"],
      subject: "New PawBucks User Feedback",
      html: `
        <h2>New Feedback Received</h2>
        <p><strong>From:</strong> ${userName || "Anonymous"} ${userEmail ? `(${userEmail})` : ""}</p>
        <hr />
        <p><strong>Message:</strong></p>
        <p style="white-space: pre-wrap;">${feedback}</p>
        <hr />
        <p style="color: #888; font-size: 12px;">This feedback was submitted through the PawBucks platform.</p>
      `,
    });

    console.log("Feedback email sent successfully:", emailResponse);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { "Content-Type": "application/json", ...corsHeaders },
    });
  } catch (error: any) {
    console.error("Error sending feedback email:", error);
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
