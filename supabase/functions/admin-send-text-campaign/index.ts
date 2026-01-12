import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  phone: string;
  userId: string;
  name: string;
}

interface TextCampaignRequest {
  title: string;
  message: string;
  recipientType: string;
  recipients: Recipient[];
}

serve(async (req) => {
  // Handle CORS
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const twilioAccountSid = Deno.env.get("TWILIO_ACCOUNT_SID");
    const twilioAuthToken = Deno.env.get("TWILIO_AUTH_TOKEN");
    const twilioPhoneNumber = Deno.env.get("TWILIO_PHONE_NUMBER");

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify admin authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: "No authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Check admin role
    const { data: roles, error: rolesError } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "superadmin"]);

    if (rolesError || !roles || roles.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Admin access required" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request
    const { title, message, recipientType, recipients }: TextCampaignRequest = await req.json();

    if (!title || !message || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("text_campaigns")
      .insert({
        title,
        message,
        recipient_type: recipientType,
        recipient_count: recipients.length,
        status: "sending",
        created_by: user.id,
      })
      .select()
      .single();

    if (campaignError) {
      console.error("Error creating campaign:", campaignError);
      return new Response(
        JSON.stringify({ success: false, error: "Failed to create campaign" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let sentCount = 0;
    let failedCount = 0;
    const messageResults: { phone: string; status: string; error?: string }[] = [];

    // Check if Twilio is configured
    const twilioConfigured = twilioAccountSid && twilioAuthToken && twilioPhoneNumber;

    if (!twilioConfigured) {
      console.log("Twilio not configured - simulating SMS send");
      // Simulate sending for demo purposes
      for (const recipient of recipients) {
        // Create log entry
        await supabaseAdmin
          .from("text_message_logs")
          .insert({
            campaign_id: campaign.id,
            phone_number: recipient.phone,
            user_id: recipient.userId,
            status: "simulated",
            sent_at: new Date().toISOString(),
          });
        
        sentCount++;
        messageResults.push({ phone: recipient.phone, status: "simulated" });
      }
    } else {
      // Send actual SMS via Twilio
      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Messages.json`;
      const twilioAuth = btoa(`${twilioAccountSid}:${twilioAuthToken}`);

      for (const recipient of recipients) {
        try {
          // Format phone number (ensure it has country code)
          let formattedPhone = recipient.phone.replace(/\D/g, "");
          if (!formattedPhone.startsWith("1") && formattedPhone.length === 10) {
            formattedPhone = "1" + formattedPhone;
          }
          if (!formattedPhone.startsWith("+")) {
            formattedPhone = "+" + formattedPhone;
          }

          const response = await fetch(twilioUrl, {
            method: "POST",
            headers: {
              "Authorization": `Basic ${twilioAuth}`,
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: new URLSearchParams({
              To: formattedPhone,
              From: twilioPhoneNumber,
              Body: message,
            }),
          });

          const result = await response.json();

          if (response.ok) {
            await supabaseAdmin
              .from("text_message_logs")
              .insert({
                campaign_id: campaign.id,
                phone_number: recipient.phone,
                user_id: recipient.userId,
                status: "sent",
                sent_at: new Date().toISOString(),
              });
            
            sentCount++;
            messageResults.push({ phone: recipient.phone, status: "sent" });
          } else {
            await supabaseAdmin
              .from("text_message_logs")
              .insert({
                campaign_id: campaign.id,
                phone_number: recipient.phone,
                user_id: recipient.userId,
                status: "failed",
                error_message: result.message || "Unknown error",
              });
            
            failedCount++;
            messageResults.push({ phone: recipient.phone, status: "failed", error: result.message });
          }
        } catch (error: unknown) {
          const errorMessage = error instanceof Error ? error.message : "Send failed";
          console.error(`Error sending to ${recipient.phone}:`, error);
          
          await supabaseAdmin
            .from("text_message_logs")
            .insert({
              campaign_id: campaign.id,
              phone_number: recipient.phone,
              user_id: recipient.userId,
              status: "failed",
              error_message: errorMessage,
            });
          
          failedCount++;
          messageResults.push({ phone: recipient.phone, status: "failed", error: errorMessage });
        }
      }
    }
    // Update campaign with results
    const finalStatus = failedCount === 0 ? "sent" : (sentCount === 0 ? "failed" : "partial");
    
    await supabaseAdmin
      .from("text_campaigns")
      .update({
        sent_count: sentCount,
        failed_count: failedCount,
        status: finalStatus,
        sent_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);

    // Log to audit
    await supabaseAdmin
      .from("audit_logs")
      .insert({
        admin_id: user.id,
        action: "send_text_campaign",
        entity_type: "text_campaign",
        entity_id: campaign.id,
        changes: {
          title,
          recipientType,
          recipientCount: recipients.length,
          sentCount,
          failedCount,
          twilioConfigured,
        },
      });

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: campaign.id,
        sent: sentCount,
        failed: failedCount,
        twilioConfigured,
        results: messageResults.slice(0, 10), // Return first 10 for debugging
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in admin-send-text-campaign:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
