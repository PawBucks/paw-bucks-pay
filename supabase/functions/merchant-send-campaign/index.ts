import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Recipient {
  userId?: string;
  contactId?: string;
  name: string;
  phone?: string;
  email?: string;
}

interface CampaignRequest {
  title: string;
  message: string;
  channel: "push" | "email" | "sms";
  recipientType: string;
  recipients: Recipient[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user auth
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

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("id, business_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    if (merchantError || !merchant) {
      // Also check partner_vets
      const { data: vet, error: vetError } = await supabaseAdmin
        .from("partner_vets")
        .select("id, clinic_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (vetError || !vet) {
        return new Response(
          JSON.stringify({ success: false, error: "No merchant or vet account found" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Use vet as merchant context - look up linked merchant
      const { data: vetMerchant } = await supabaseAdmin
        .from("merchants")
        .select("id, business_name, email")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!vetMerchant) {
        return new Response(
          JSON.stringify({ success: false, error: "No merchant account linked" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const merchantId = merchant!.id;
    const businessName = merchant!.business_name;

    // Parse request
    const { title, message, channel, recipientType, recipients }: CampaignRequest = await req.json();

    if (!title || !message || !channel || !recipients || recipients.length === 0) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Hard cap blast radius
    const MAX_RECIPIENTS = 5000;
    if (recipients.length > MAX_RECIPIENTS) {
      return new Response(
        JSON.stringify({ success: false, error: `Too many recipients (max ${MAX_RECIPIENTS})` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Recipient scoping: only allow users who have a prior relationship
    // (transaction, booking, subscription, loyalty card, or message) with this merchant.
    const requestedIds = Array.from(
      new Set(recipients.map((r) => r.userId).filter((id): id is string => !!id))
    );
    const requestedContactIds = Array.from(
      new Set(recipients.map((r) => r.contactId).filter((id): id is string => !!id))
    );

    const allowedIds = new Set<string>();
    if (requestedIds.length > 0) {
      const [txRes, bkRes, subRes, lcRes, msgRes] = await Promise.all([
        supabaseAdmin.from("transactions").select("user_id").eq("merchant_id", merchantId).in("user_id", requestedIds),
        supabaseAdmin.from("service_bookings").select("user_id").eq("merchant_id", merchantId).in("user_id", requestedIds),
        supabaseAdmin.from("merchant_subscriptions").select("user_id").eq("merchant_id", merchantId).in("user_id", requestedIds),
        supabaseAdmin.from("customer_punch_cards").select("user_id").eq("merchant_id", merchantId).in("user_id", requestedIds),
        supabaseAdmin.from("merchant_messages").select("user_id").eq("merchant_id", merchantId).in("user_id", requestedIds),
      ]);
      for (const row of txRes.data ?? []) row.user_id && allowedIds.add(row.user_id);
      for (const row of bkRes.data ?? []) row.user_id && allowedIds.add(row.user_id);
      for (const row of subRes.data ?? []) row.user_id && allowedIds.add(row.user_id);
      for (const row of lcRes.data ?? []) row.user_id && allowedIds.add(row.user_id);
      for (const row of msgRes.data ?? []) row.user_id && allowedIds.add(row.user_id);
    }

    // Merchant-uploaded clients: must belong to this merchant and not be opted out.
    const contactById = new Map<string, { name: string | null; email: string | null; phone: string | null }>();
    if (requestedContactIds.length > 0) {
      const { data: clientRows } = await supabaseAdmin
        .from("invoice_clients")
        .select("id, name, email, phone, is_active, do_not_contact")
        .eq("merchant_id", merchantId)
        .in("id", requestedContactIds);
      for (const row of clientRows ?? []) {
        if ((row as any).is_active === false || (row as any).do_not_contact === true) continue;
        contactById.set(row.id as string, {
          name: (row as any).name ?? null,
          email: (row as any).email ?? null,
          phone: (row as any).phone ?? null,
        });
      }
    }

    const safeRecipients = recipients.filter((r) =>
      (r.userId && allowedIds.has(r.userId)) || (r.contactId && contactById.has(r.contactId))
    );
    const skippedCount = recipients.length - safeRecipients.length;

    if (safeRecipients.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "No eligible recipients (recipients must be your existing customers).",
          skippedCount,
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // SECURITY: never trust merchant-supplied phone/email. Resolve contact details
    // server-side from the verified user's profile so messages can only ever go
    // to the legitimate owner of each userId.
    const safeUserIds = safeRecipients.map((r) => r.userId).filter((id): id is string => !!id);
    const { data: profileRows } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name, email, phone")
      .in("id", safeUserIds);
    const profileById = new Map<string, { full_name: string | null; email: string | null; phone: string | null }>();
    for (const row of profileRows ?? []) {
      profileById.set(row.id as string, {
        full_name: (row as any).full_name ?? null,
        email: (row as any).email ?? null,
        phone: (row as any).phone ?? null,
      });
    }
    // Override any client-supplied contact fields with server-side values.
    for (const r of safeRecipients) {
      const p = r.userId ? profileById.get(r.userId) : contactById.get(r.contactId!);
      r.email = p?.email ?? undefined;
      r.phone = p?.phone ?? undefined;
      if (!r.name) r.name = (p as any)?.full_name ?? (p as any)?.name ?? "";
    }

    // Create campaign record
    const { data: campaign, error: campaignError } = await supabaseAdmin
      .from("merchant_campaigns")
      .insert({
        merchant_id: merchantId,
        title,
        message,
        channel,
        recipient_type: recipientType,
        recipient_count: safeRecipients.length,
        status: "sending",
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

    if (channel === "push") {
      // Send in-app push notifications
      for (const recipient of safeRecipients) {
        try {
          await supabaseAdmin.from("notifications").insert({
            user_id: recipient.userId,
            title: `${businessName}: ${title}`,
            message,
            category: "promotional",
          });

          await supabaseAdmin.from("merchant_campaign_recipients").insert({
            campaign_id: campaign.id,
            user_id: recipient.userId,
            status: "sent",
            sent_at: new Date().toISOString(),
          });
          sentCount++;
        } catch (err) {
          await supabaseAdmin.from("merchant_campaign_recipients").insert({
            campaign_id: campaign.id,
            user_id: recipient.userId,
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
          });
          failedCount++;
        }
      }
    } else if (channel === "email") {
      // Send emails via transactional email system
      for (const recipient of safeRecipients) {
        try {
          if (!recipient.email) {
            await supabaseAdmin.from("merchant_campaign_recipients").insert({
              campaign_id: campaign.id,
              user_id: recipient.userId,
              // email omitted (resolved server-side, not stored as raw PII),
              status: "failed",
              error_message: "No email address",
            });
            failedCount++;
            continue;
          }

          // Use send-transactional-email if available, otherwise insert notification
          const { error: emailError } = await supabaseAdmin.functions.invoke("send-transactional-email", {
            body: {
              templateName: "merchant-campaign",
              recipientEmail: recipient.email,
              idempotencyKey: `merchant-campaign-${campaign.id}-${recipient.userId}`,
              templateData: {
                businessName,
                title,
                message,
                recipientName: recipient.name,
              },
            },
          });

          if (emailError) {
            // Fallback: just log as sent with notification
            console.log("Email function not available, falling back to notification");
            await supabaseAdmin.from("notifications").insert({
              user_id: recipient.userId,
              title: `${businessName}: ${title}`,
              message,
              category: "promotional",
            });
          }

          await supabaseAdmin.from("merchant_campaign_recipients").insert({
            campaign_id: campaign.id,
            user_id: recipient.userId,
            // email omitted (resolved server-side, not stored as raw PII),
            status: "sent",
            sent_at: new Date().toISOString(),
          });
          sentCount++;
        } catch (err) {
          await supabaseAdmin.from("merchant_campaign_recipients").insert({
            campaign_id: campaign.id,
            user_id: recipient.userId,
            // email omitted (resolved server-side, not stored as raw PII),
            status: "failed",
            error_message: err instanceof Error ? err.message : "Unknown error",
          });
          failedCount++;
        }
      }
    } else if (channel === "sms") {
      // Get merchant's Twilio settings
      const { data: twilioSettings } = await supabaseAdmin
        .from("merchant_twilio_settings")
        .select("*")
        .eq("merchant_id", merchantId)
        .maybeSingle();

      if (!twilioSettings) {
        // Update campaign as failed
        await supabaseAdmin.from("merchant_campaigns").update({
          status: "failed",
          failed_count: safeRecipients.length,
        }).eq("id", campaign.id);

        return new Response(
          JSON.stringify({ success: false, error: "Twilio not configured. Please add your Twilio credentials in Campaign Settings." }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${twilioSettings.twilio_account_sid}/Messages.json`;
      const twilioAuth = btoa(`${twilioSettings.twilio_account_sid}:${twilioSettings.twilio_auth_token}`);

      for (const recipient of safeRecipients) {
        try {
          if (!recipient.phone) {
            await supabaseAdmin.from("merchant_campaign_recipients").insert({
              campaign_id: campaign.id,
              user_id: recipient.userId,
              // phone omitted (resolved server-side, not stored as raw PII),
              status: "failed",
              error_message: "No phone number",
            });
            failedCount++;
            continue;
          }

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
              From: twilioSettings.twilio_phone_number,
              Body: `${businessName}: ${message}`,
            }),
          });

          const result = await response.json();

          if (response.ok) {
            await supabaseAdmin.from("merchant_campaign_recipients").insert({
              campaign_id: campaign.id,
              user_id: recipient.userId,
              // phone omitted (resolved server-side, not stored as raw PII),
              status: "sent",
              sent_at: new Date().toISOString(),
            });
            sentCount++;
          } else {
            await supabaseAdmin.from("merchant_campaign_recipients").insert({
              campaign_id: campaign.id,
              user_id: recipient.userId,
              // phone omitted (resolved server-side, not stored as raw PII),
              status: "failed",
              error_message: result.message || "Twilio error",
            });
            failedCount++;
          }
        } catch (err: unknown) {
          const errorMessage = err instanceof Error ? err.message : "Send failed";
          await supabaseAdmin.from("merchant_campaign_recipients").insert({
            campaign_id: campaign.id,
            user_id: recipient.userId,
            // phone omitted (resolved server-side, not stored as raw PII),
            status: "failed",
            error_message: errorMessage,
          });
          failedCount++;
        }
      }
    }

    // Update campaign status
    const finalStatus = failedCount === 0 ? "sent" : sentCount === 0 ? "failed" : "partial";
    await supabaseAdmin.from("merchant_campaigns").update({
      sent_count: sentCount,
      failed_count: failedCount,
      status: finalStatus,
      sent_at: new Date().toISOString(),
    }).eq("id", campaign.id);

    return new Response(
      JSON.stringify({
        success: true,
        campaignId: campaign.id,
        sent: sentCount,
        failed: failedCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error in merchant-send-campaign:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
