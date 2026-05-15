import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { Webhook } from "https://esm.sh/svix@1.21.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check: GET request returns webhook configuration status without
  // exposing the secret value. Use this to verify your Resend inbound
  // webhook endpoint URL is reachable and that RESEND_WEBHOOK_SECRET is set.
  // Example: curl https://<project>.functions.supabase.co/receive-pet-email/health
  const url = new URL(req.url);
  if (req.method === "GET") {
    const secret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    const configured = !!secret;
    // Validate secret format (Svix secrets start with "whsec_")
    const validFormat = configured && secret!.startsWith("whsec_");
    return new Response(
      JSON.stringify({
        status: configured && validFormat ? "ok" : "misconfigured",
        webhook_secret_configured: configured,
        webhook_secret_format_valid: validFormat,
        endpoint: "receive-pet-email",
        signature_verification: "svix",
        expected_headers: ["svix-id", "svix-timestamp", "svix-signature"],
        hint: !configured
          ? "Set RESEND_WEBHOOK_SECRET in your Edge Function secrets to the value shown when creating the Resend webhook."
          : !validFormat
          ? "RESEND_WEBHOOK_SECRET should start with 'whsec_'. Copy the signing secret from your Resend webhook settings."
          : "Webhook is configured. Make sure your Resend inbound webhook in https://resend.com/webhooks points to this function URL and uses this same signing secret.",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Verify Resend webhook signature (Svix) to prevent forged email injection.
    // We need the raw body for signature verification, so read it once and
    // re-parse below.
    const rawBody = await req.text();
    const resendWebhookSecret = Deno.env.get("RESEND_WEBHOOK_SECRET");
    if (resendWebhookSecret) {
      try {
        const wh = new Webhook(resendWebhookSecret);
        const headers: Record<string, string> = {};
        req.headers.forEach((value, key) => {
          headers[key] = value;
        });
        wh.verify(rawBody, headers);
      } catch (sigErr) {
        console.error("Resend webhook signature verification failed:", sigErr);
        return new Response(
          JSON.stringify({ error: "Invalid signature" }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      console.error("RESEND_WEBHOOK_SECRET not configured — rejecting unsigned inbound email");
      return new Response(
        JSON.stringify({ error: "Webhook not configured" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resend sends inbound emails as JSON or multipart
    const contentType = req.headers.get("content-type") || "";
    let emailData: any;

    if (contentType.includes("application/json")) {
      const rawPayload = JSON.parse(rawBody);
      console.log("Raw JSON payload keys:", Object.keys(rawPayload));
      
      // Resend webhook wraps email data inside "data" key
      // Format: { type: "email.received", created_at: "...", data: { from, to, subject, ... } }
      if (rawPayload.data && (rawPayload.type || rawPayload.created_at)) {
        console.log("Detected Resend webhook format, unwrapping data");
        emailData = rawPayload.data;
      } else {
        emailData = rawPayload;
      }
    } else {
      // Handle multipart form data from Resend (rebuild Request from rawBody)
      const fakeReq = new Request("http://internal/", {
        method: "POST",
        headers: { "content-type": contentType },
        body: rawBody,
      });
      const formData = await fakeReq.formData();
      emailData = {
        from: formData.get("from"),
        to: formData.get("to"),
        subject: formData.get("subject"),
        text: formData.get("text"),
        html: formData.get("html"),
        headers: formData.get("headers"),
      };

      // Collect attachments
      const attachments: any[] = [];
      for (const [key, value] of formData.entries()) {
        if (key.startsWith("attachment") && value instanceof File) {
          attachments.push(value);
        }
      }
      emailData.attachments = attachments;
    }

    console.log("Received inbound email:", {
      from: emailData.from,
      to: emailData.to,
      subject: emailData.subject,
    });

    // Extract recipient email to find the pet
    const toEmail = Array.isArray(emailData.to)
      ? emailData.to[0]
      : typeof emailData.to === "string"
      ? emailData.to
      : emailData.to?.address || emailData.to;

    if (!toEmail) {
      console.error("No recipient email found");
      return new Response(JSON.stringify({ error: "No recipient" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract just the email address if it includes name
    const emailMatch = toEmail.match(/<?([^<>\s]+@[^<>\s]+)>?/);
    const recipientEmail = emailMatch ? emailMatch[1].toLowerCase() : toEmail.toLowerCase();

    // Look up the pet email address
    const { data: petEmail, error: petEmailError } = await supabase
      .from("pet_email_addresses")
      .select("*, pet_profiles!inner(id, name, user_id)")
      .eq("email_address", recipientEmail)
      .eq("is_active", true)
      .single();

    if (petEmailError || !petEmail) {
      console.error("Pet email not found:", recipientEmail, petEmailError);
      return new Response(JSON.stringify({ error: "Unknown recipient" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Extract sender info
    const fromStr = typeof emailData.from === "string" ? emailData.from : emailData.from?.address || "";
    const fromMatch = fromStr.match(/^(?:"?([^"]*)"?\s)?<?([^<>\s]+@[^<>\s]+)>?$/);
    const senderName = fromMatch?.[1]?.trim() || null;
    const senderEmail = fromMatch?.[2]?.toLowerCase() || fromStr.toLowerCase();

    // Store the inbound email record
    const { data: inboundEmail, error: emailInsertError } = await supabase
      .from("pet_inbound_emails")
      .insert({
        pet_id: petEmail.pet_id,
        pet_email_id: petEmail.id,
        from_email: senderEmail,
        from_name: senderName,
        subject: emailData.subject || "(No Subject)",
        body_text: emailData.text || null,
        body_html: emailData.html || null,
        processing_status: "processing",
      })
      .select()
      .single();

    if (emailInsertError) {
      console.error("Failed to store email:", emailInsertError);
      throw emailInsertError;
    }

    // Process attachments
    const attachments = emailData.attachments || [];
    const documents: any[] = [];
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const inboundEmailId = emailData.id || emailData.email_id || null;

    for (const attachment of attachments) {
      try {
        let fileName: string;
        let fileBuffer: ArrayBuffer;
        let fileType: string;
        let fileSize: number;

        // Log attachment keys for debugging
        if (!(attachment instanceof File)) {
          console.log("Attachment object keys:", Object.keys(attachment), "filename:", attachment.filename || attachment.name, "has content:", !!attachment.content, "has data:", !!attachment.data);
        }

        if (attachment instanceof File) {
          fileName = attachment.name;
          fileBuffer = await attachment.arrayBuffer();
          fileType = attachment.type;
          fileSize = attachment.size;
        } else if (attachment.filename || attachment.name) {
          // JSON format from Resend - content may be in 'content' or 'data' field
          fileName = attachment.filename || attachment.name;
          const content = attachment.content || attachment.data;
          fileType = attachment.contentType || attachment.mimeType || attachment.content_type || "application/octet-stream";

          // Resend inbound webhooks deliver attachment METADATA only.
          // When `content`/`data` is missing, fetch the binary via the
          // Resend Receiving API using the attachment id + parent email id.
          if (!content) {
            const attachmentId = attachment.id;
            if (!resendApiKey || !inboundEmailId || !attachmentId) {
              console.warn(
                "Attachment has no content and cannot fetch from Resend API:",
                fileName,
                { hasResendKey: !!resendApiKey, inboundEmailId, attachmentId }
              );
              const { data: doc } = await supabase
                .from("pet_inbound_documents")
                .insert({
                  pet_id: petEmail.pet_id,
                  email_id: inboundEmail.id,
                  file_name: fileName,
                  file_url: null,
                  file_type: fileType,
                  file_size_bytes: 0,
                  category: "uncategorized",
                  sender_email: senderEmail,
                  sender_name: senderName,
                })
                .select()
                .single();
              if (doc) documents.push(doc);
              continue;
            }

            try {
              const metaRes = await fetch(
                `https://api.resend.com/emails/receiving/${inboundEmailId}/attachments/${attachmentId}`,
                { headers: { Authorization: `Bearer ${resendApiKey}` } }
              );
              if (!metaRes.ok) {
                throw new Error(`Resend attachment metadata fetch failed: ${metaRes.status} ${await metaRes.text()}`);
              }
              const meta = await metaRes.json();
              const downloadUrl = meta.download_url;
              if (!downloadUrl) throw new Error("No download_url in Resend response");

              const binRes = await fetch(downloadUrl);
              if (!binRes.ok) throw new Error(`Attachment download failed: ${binRes.status}`);
              fileBuffer = await binRes.arrayBuffer();
              fileSize = fileBuffer.byteLength;
              if (meta.content_type) fileType = meta.content_type;
              console.log("Fetched attachment from Resend API:", fileName, fileSize, "bytes");
            } catch (fetchErr) {
              console.error("Failed to fetch attachment from Resend API:", fileName, fetchErr);
              const { data: doc } = await supabase
                .from("pet_inbound_documents")
                .insert({
                  pet_id: petEmail.pet_id,
                  email_id: inboundEmail.id,
                  file_name: fileName,
                  file_url: null,
                  file_type: fileType,
                  file_size_bytes: 0,
                  category: "uncategorized",
                  sender_email: senderEmail,
                  sender_name: senderName,
                })
                .select()
                .single();
              if (doc) documents.push(doc);
              continue;
            }
          } else {
          // Robust base64 decoding: clean whitespace and handle URL-safe base64
          let cleanContent = content.replace(/[\s\r\n]/g, "");
          // Convert URL-safe base64 to standard base64
          cleanContent = cleanContent.replace(/-/g, "+").replace(/_/g, "/");
          // Add padding if needed
          const pad = cleanContent.length % 4;
          if (pad === 2) cleanContent += "==";
          else if (pad === 3) cleanContent += "=";
          
          try {
            const binaryStr = atob(cleanContent);
            const bytes = new Uint8Array(binaryStr.length);
            for (let i = 0; i < binaryStr.length; i++) {
              bytes[i] = binaryStr.charCodeAt(i);
            }
            fileBuffer = bytes.buffer;
            fileSize = bytes.length;
          } catch (b64Err) {
            console.error("Base64 decode failed for", fileName, "- trying raw content. Error:", b64Err);
            // Fallback: treat content as raw text
            const encoder = new TextEncoder();
            const rawBytes = encoder.encode(content);
            fileBuffer = rawBytes.buffer;
            fileSize = rawBytes.length;
            fileType = "application/octet-stream";
          }
          }
        } else {
          continue;
        }

        // Upload to storage
        const storagePath = `${petEmail.pet_id}/${inboundEmail.id}/${Date.now()}-${fileName}`;
        const { error: uploadError } = await supabase.storage
          .from("pet-email-attachments")
          .upload(storagePath, fileBuffer, {
            contentType: fileType,
            upsert: false,
          });

        if (uploadError) {
          console.error("Upload error for", fileName, uploadError);
          continue;
        }

        // Get signed URL for access
        const { data: urlData } = await supabase.storage
          .from("pet-email-attachments")
          .createSignedUrl(storagePath, 60 * 60 * 24 * 365); // 1 year

        const fileUrl = urlData?.signedUrl || storagePath;

        // Insert document record (uncategorized initially)
        const { data: doc } = await supabase
          .from("pet_inbound_documents")
          .insert({
            pet_id: petEmail.pet_id,
            email_id: inboundEmail.id,
            file_name: fileName,
            file_url: fileUrl,
            file_type: fileType,
            file_size_bytes: fileSize,
            category: "uncategorized",
            sender_email: senderEmail,
            sender_name: senderName,
          })
          .select()
          .single();

        if (doc) documents.push(doc);
      } catch (attachErr) {
        console.error("Error processing attachment:", attachErr);
      }
    }

    // If no attachments were processed, store the email body as a document
    if (documents.length === 0) {
      const bodyContent = emailData.text || emailData.html || "(No body content)";
      const bodyBlob = new TextEncoder().encode(bodyContent);
      const bodyPath = `${petEmail.pet_id}/${inboundEmail.id}/email-body.txt`;

      const { error: bodyUploadError } = await supabase.storage
        .from("pet-email-attachments")
        .upload(bodyPath, bodyBlob, {
          contentType: "text/plain",
          upsert: false,
        });

      if (bodyUploadError) {
        console.error("Email body upload error:", bodyUploadError);
      }

      const { data: urlData } = await supabase.storage
        .from("pet-email-attachments")
        .createSignedUrl(bodyPath, 60 * 60 * 24 * 365);

      const { data: doc, error: docError } = await supabase
        .from("pet_inbound_documents")
        .insert({
          pet_id: petEmail.pet_id,
          email_id: inboundEmail.id,
          file_name: `Email: ${emailData.subject || "No Subject"}`,
          file_url: urlData?.signedUrl || bodyPath,
          file_type: "text/plain",
          file_size_bytes: bodyBlob.length,
          category: "uncategorized",
          sender_email: senderEmail,
          sender_name: senderName,
        })
        .select()
        .single();

      if (docError) {
        console.error("Email body document insert error:", docError);
      }
      if (doc) documents.push(doc);
    }

    // Trigger AI categorization
    if (documents.length > 0) {
      try {
        const categorizationUrl = `${supabaseUrl}/functions/v1/categorize-pet-document`;
        await fetch(categorizationUrl, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${serviceRoleKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            documents: documents.map((d) => ({
              id: d.id,
              file_name: d.file_name,
              file_type: d.file_type,
              sender_email: senderEmail,
              sender_name: senderName,
              email_subject: emailData.subject,
              email_body_snippet: (emailData.text || "").substring(0, 1000),
            })),
            pet_id: petEmail.pet_id,
          }),
        });
      } catch (catErr) {
        console.error("Categorization trigger failed (non-blocking):", catErr);
      }
    }

    // Update email processing status
    await supabase
      .from("pet_inbound_emails")
      .update({ processing_status: "completed" })
      .eq("id", inboundEmail.id);

    // Notify pet owner with link to pet inbox
    await supabase.from("notifications").insert({
      user_id: petEmail.pet_profiles.user_id,
      title: "📧 New Document Received",
      message: `${senderName || senderEmail} sent ${documents.length} document(s) for ${petEmail.pet_profiles.name}${emailData.subject ? `: ${emailData.subject}` : ""}`,
      category: "transactional",
      link_url: `/pet-health/${petEmail.pet_id}?tab=inbox`,
    });

    return new Response(
      JSON.stringify({
        success: true,
        emailId: inboundEmail.id,
        documentsProcessed: documents.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Inbound email error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
