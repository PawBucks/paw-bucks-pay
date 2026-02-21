import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Resend sends inbound emails as JSON or multipart
    const contentType = req.headers.get("content-type") || "";
    let emailData: any;

    if (contentType.includes("application/json")) {
      emailData = await req.json();
    } else {
      // Handle multipart form data from Resend
      const formData = await req.formData();
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

    for (const attachment of attachments) {
      try {
        let fileName: string;
        let fileBuffer: ArrayBuffer;
        let fileType: string;
        let fileSize: number;

        if (attachment instanceof File) {
          fileName = attachment.name;
          fileBuffer = await attachment.arrayBuffer();
          fileType = attachment.type;
          fileSize = attachment.size;
        } else if (attachment.filename) {
          // JSON format from Resend
          fileName = attachment.filename;
          const content = attachment.content;
          // Decode base64 content
          const binaryStr = atob(content);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          fileBuffer = bytes.buffer;
          fileType = attachment.contentType || "application/octet-stream";
          fileSize = bytes.length;
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

    // If email body exists but no attachments, store the email body as a document too
    if (documents.length === 0 && (emailData.text || emailData.html)) {
      const bodyContent = emailData.text || emailData.html || "";
      const bodyBlob = new TextEncoder().encode(bodyContent);
      const bodyPath = `${petEmail.pet_id}/${inboundEmail.id}/email-body.txt`;

      await supabase.storage
        .from("pet-email-attachments")
        .upload(bodyPath, bodyBlob, {
          contentType: "text/plain",
          upsert: false,
        });

      const { data: urlData } = await supabase.storage
        .from("pet-email-attachments")
        .createSignedUrl(bodyPath, 60 * 60 * 24 * 365);

      const { data: doc } = await supabase
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

    // Notify pet owner
    await supabase.from("notifications").insert({
      user_id: petEmail.pet_profiles.user_id,
      title: "📧 New Document Received",
      message: `${senderName || senderEmail} sent ${documents.length} document(s) for ${petEmail.pet_profiles.name}${emailData.subject ? `: ${emailData.subject}` : ""}`,
      category: "transactional",
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
