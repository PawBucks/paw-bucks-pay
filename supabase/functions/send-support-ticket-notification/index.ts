import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type NotificationType =
  | "ticket_created"
  | "status_changed"
  | "admin_reply"
  | "user_reply";

interface NotificationRequest {
  type: NotificationType;
  ticketId: string;
  ticketNumber: string;
  ticketSubject: string;
  // For status_changed
  newStatus?: string;
  oldStatus?: string;
  resolutionNotes?: string;
  // For replies
  replyMessage?: string;
  // Sender info (for user replies to notify admins)
  senderName?: string;
  submitterType?: string;
}

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  awaiting_response: "Awaiting Response",
  resolved: "Resolved",
  closed: "Closed",
};

function buildEmailHtml(data: NotificationRequest & { recipientName: string }): string {
  const dateStr = new Date().toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
    hour: "2-digit", minute: "2-digit", timeZoneName: "short",
  });

  let bannerColor = "#3b82f6";
  let bannerTitle = "Support Ticket Update";
  let bannerSubtitle = data.ticketNumber;
  let bodyContent = "";

  switch (data.type) {
    case "ticket_created":
      bannerColor = "#7DD4D4";
      bannerTitle = "Ticket Submitted";
      bodyContent = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
          Your support ticket <strong>${data.ticketNumber}</strong> has been received. Our team will review it and get back to you as soon as possible.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 0 0 24px 0;">
          <tr><td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
            <table width="100%"><tr>
              <td style="color: #6b7280; font-size: 14px;">Subject</td>
              <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${data.ticketSubject}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 16px 20px;">
            <table width="100%"><tr>
              <td style="color: #6b7280; font-size: 14px;">Submitted</td>
              <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${dateStr}</td>
            </tr></table>
          </td></tr>
        </table>`;
      break;

    case "status_changed":
      bannerColor = data.newStatus === "resolved" ? "#10b981" : "#f59e0b";
      bannerTitle = data.newStatus === "resolved" ? "Ticket Resolved" : "Status Updated";
      bodyContent = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
          The status of your support ticket <strong>${data.ticketNumber}</strong> has been updated.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 0 0 24px 0;">
          <tr><td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
            <table width="100%"><tr>
              <td style="color: #6b7280; font-size: 14px;">Subject</td>
              <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${data.ticketSubject}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 16px 20px; border-bottom: 1px solid #e5e7eb;">
            <table width="100%"><tr>
              <td style="color: #6b7280; font-size: 14px;">Previous Status</td>
              <td style="text-align: right; font-weight: 600; color: #6b7280; font-size: 14px;">${STATUS_LABELS[data.oldStatus || ""] || data.oldStatus}</td>
            </tr></table>
          </td></tr>
          <tr><td style="padding: 16px 20px;">
            <table width="100%"><tr>
              <td style="color: #6b7280; font-size: 14px;">New Status</td>
              <td style="text-align: right; font-weight: 700; color: ${data.newStatus === "resolved" ? "#10b981" : "#f59e0b"}; font-size: 16px;">${STATUS_LABELS[data.newStatus || ""] || data.newStatus}</td>
            </tr></table>
          </td></tr>
        </table>
        ${data.resolutionNotes ? `
        <div style="background-color: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 16px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 4px 0; font-size: 13px; font-weight: 600; color: #065f46;">Resolution Notes:</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.5;">${data.resolutionNotes}</p>
        </div>` : ""}`;
      break;

    case "admin_reply":
      bannerColor = "#6366f1";
      bannerTitle = "New Reply from Support";
      bodyContent = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
          Our support team has replied to your ticket <strong>${data.ticketNumber}</strong>.
        </p>
        <div style="background-color: #eef2ff; border-left: 4px solid #6366f1; border-radius: 0 8px 8px 0; padding: 16px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #4338ca;">🛡️ Support Team</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${data.replyMessage}</p>
        </div>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Log in to your account to reply.</p>`;
      break;

    case "user_reply":
      bannerColor = "#f59e0b";
      bannerTitle = "New Reply on Ticket";
      bodyContent = `
        <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">
          <strong>${data.senderName || "A user"}</strong> (${data.submitterType || "user"}) has replied to ticket <strong>${data.ticketNumber}</strong>.
        </p>
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f9fafb; border-radius: 8px; border: 1px solid #e5e7eb; margin: 0 0 16px 0;">
          <tr><td style="padding: 16px 20px;">
            <table width="100%"><tr>
              <td style="color: #6b7280; font-size: 14px;">Subject</td>
              <td style="text-align: right; font-weight: 600; color: #111827; font-size: 14px;">${data.ticketSubject}</td>
            </tr></table>
          </td></tr>
        </table>
        <div style="background-color: #f3f4f6; border-left: 4px solid #9ca3af; border-radius: 0 8px 8px 0; padding: 16px; margin: 0 0 24px 0;">
          <p style="margin: 0 0 4px 0; font-size: 12px; font-weight: 600; color: #6b7280;">👤 ${data.senderName || "User"}</p>
          <p style="margin: 0; font-size: 14px; color: #374151; line-height: 1.6; white-space: pre-wrap;">${data.replyMessage}</p>
        </div>
        <p style="margin: 0; font-size: 14px; color: #6b7280;">Log in to the admin dashboard to respond.</p>`;
      break;
  }

  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px rgba(0,0,0,0.1); max-width: 600px;">
        <tr><td style="padding: 32px; text-align: center; border-radius: 12px 12px 0 0;">
          <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
        </td></tr>
        <tr><td style="padding: 0 32px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background: ${bannerColor}; border-radius: 12px;">
            <tr><td style="padding: 20px; text-align: center;">
              <p style="margin: 0 0 4px 0; font-size: 14px; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 1px;">${bannerTitle}</p>
              <p style="margin: 0; font-size: 18px; font-weight: 700; color: #ffffff;">${bannerSubtitle} — ${data.ticketSubject}</p>
            </td></tr>
          </table>
        </td></tr>
        <tr><td style="padding: 32px;">
          <p style="margin: 0 0 20px 0; font-size: 16px; color: #374151; line-height: 1.6;">Hi ${data.recipientName || "there"},</p>
          ${bodyContent}
        </td></tr>
        <tr><td style="background-color: #f9fafb; padding: 24px 32px; text-align: center; border-radius: 0 0 12px 12px; border-top: 1px solid #e5e7eb;">
          <p style="color: #9ca3af; font-size: 12px; margin: 0 0 4px 0;">This is an automated support notification from PawBucks.</p>
          <p style="color: #9ca3af; font-size: 12px; margin: 0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const data: NotificationRequest = await req.json();
    console.log("Support ticket notification:", data.type, data.ticketNumber);

    const { type, ticketId, ticketNumber, ticketSubject } = data;

    if (!type || !ticketId || !ticketNumber || !ticketSubject) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get ticket owner info
    const { data: ticket } = await supabaseAdmin
      .from("support_tickets")
      .select("user_id, submitter_type")
      .eq("id", ticketId)
      .single();

    if (!ticket) {
      return new Response(
        JSON.stringify({ error: "Ticket not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // AuthZ: allow internal cross-function calls via the shared secret, or a
    // JWT-bearing caller that is either the ticket owner or an admin/superadmin.
    // Prevents unauthenticated attackers from spamming ticket owners and admins.
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const providedInternal = req.headers.get("x-internal-secret");
    const isInternal = !!(providedInternal && internalSecret && providedInternal === internalSecret);

    if (!isInternal) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (!token) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: claimsRes, error: claimsErr } = await supabaseAdmin.auth.getClaims(token);
      const callerId = claimsRes?.claims?.sub;
      if (claimsErr || !callerId) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const isOwner = callerId === ticket.user_id;
      let isAdmin = false;
      if (!isOwner) {
        const { data: roles } = await supabaseAdmin
          .from("user_roles")
          .select("role")
          .eq("user_id", callerId);
        isAdmin = !!roles?.some((r: { role: string }) => r.role === "admin" || r.role === "superadmin");
      }
      if (!isOwner && !isAdmin) {
        return new Response(JSON.stringify({ error: "Forbidden" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get ticket owner profile & email
    const { data: ownerProfile } = await supabaseAdmin
      .from("profiles")
      .select("full_name, email")
      .eq("id", ticket.user_id)
      .single();

    // Get all superadmins for admin notifications
    const { data: adminRoles } = await supabaseAdmin
      .from("user_roles")
      .select("user_id")
      .eq("role", "superadmin");

    const adminUserIds = adminRoles?.map((r) => r.user_id) || [];

    // Get admin emails
    let adminEmails: { email: string; name: string; userId: string }[] = [];
    if (adminUserIds.length > 0) {
      const { data: adminProfiles } = await supabaseAdmin
        .from("profiles")
        .select("id, full_name, email")
        .in("id", adminUserIds);

      adminEmails = (adminProfiles || []).map((p) => ({
        email: p.email,
        name: p.full_name || "Admin",
        userId: p.id,
      }));
    }

    const notifications: { userId: string; title: string; message: string }[] = [];
    const emails: { to: string; subject: string; html: string }[] = [];

    const ownerName = ownerProfile?.full_name || "there";
    const ownerEmail = ownerProfile?.email;

    switch (type) {
      case "ticket_created": {
        // In-app notification to ticket owner (confirmation)
        notifications.push({
          userId: ticket.user_id,
          title: "🎫 Ticket Submitted",
          message: `Your support ticket ${ticketNumber} has been submitted. We'll review it shortly.`,
        });

        // Notify all admins about the new ticket
        for (const admin of adminEmails) {
          notifications.push({
            userId: admin.userId,
            title: "🆕 New Support Ticket",
            message: `New ${data.submitterType || "user"} ticket ${ticketNumber}: ${ticketSubject}`,
          });
        }

        // Email to ticket owner
        if (ownerEmail) {
          emails.push({
            to: ownerEmail,
            subject: `🎫 Ticket ${ticketNumber} — We've received your request`,
            html: buildEmailHtml({ ...data, recipientName: ownerName }),
          });
        }

        // Email to admins
        for (const admin of adminEmails) {
          emails.push({
            to: admin.email,
            subject: `🆕 New Support Ticket: ${ticketNumber} — ${ticketSubject}`,
            html: buildEmailHtml({ ...data, type: "user_reply", recipientName: admin.name, senderName: ownerName, submitterType: data.submitterType || ticket.submitter_type }),
          });
        }
        break;
      }

      case "status_changed": {
        // In-app notification to ticket owner
        const statusLabel = STATUS_LABELS[data.newStatus || ""] || data.newStatus;
        notifications.push({
          userId: ticket.user_id,
          title: data.newStatus === "resolved" ? "✅ Ticket Resolved" : "📋 Ticket Status Updated",
          message: `Your ticket ${ticketNumber} status changed to: ${statusLabel}.${data.resolutionNotes ? ` Note: ${data.resolutionNotes}` : ""}`,
        });

        // Email to ticket owner
        if (ownerEmail) {
          emails.push({
            to: ownerEmail,
            subject: data.newStatus === "resolved"
              ? `✅ Ticket ${ticketNumber} — Resolved`
              : `📋 Ticket ${ticketNumber} — Status: ${statusLabel}`,
            html: buildEmailHtml({ ...data, recipientName: ownerName }),
          });
        }
        break;
      }

      case "admin_reply": {
        // In-app notification to ticket owner
        notifications.push({
          userId: ticket.user_id,
          title: "💬 New Reply on Your Ticket",
          message: `Support team replied to ${ticketNumber}: "${(data.replyMessage || "").substring(0, 100)}${(data.replyMessage || "").length > 100 ? "..." : ""}"`,
        });

        // Email to ticket owner
        if (ownerEmail) {
          emails.push({
            to: ownerEmail,
            subject: `💬 Ticket ${ticketNumber} — New reply from support`,
            html: buildEmailHtml({ ...data, recipientName: ownerName }),
          });
        }
        break;
      }

      case "user_reply": {
        // In-app notifications to all admins
        for (const admin of adminEmails) {
          notifications.push({
            userId: admin.userId,
            title: "💬 User Replied to Ticket",
            message: `${data.senderName || "User"} replied to ${ticketNumber}: "${(data.replyMessage || "").substring(0, 100)}${(data.replyMessage || "").length > 100 ? "..." : ""}"`,
          });
        }

        // Email to admins
        for (const admin of adminEmails) {
          emails.push({
            to: admin.email,
            subject: `💬 Reply on ${ticketNumber} — ${ticketSubject}`,
            html: buildEmailHtml({ ...data, recipientName: admin.name }),
          });
        }
        break;
      }
    }

    // Insert in-app notifications
    if (notifications.length > 0) {
      const { error: notifError } = await supabaseAdmin
        .from("notifications")
        .insert(notifications.map((n) => ({
          user_id: n.userId,
          title: n.title,
          message: n.message,
          category: "transactional",
        })));
      if (notifError) {
        console.error("Error inserting notifications:", notifError);
      }
    }

    // Send emails
    if (resendApiKey && emails.length > 0) {
      const resend = new Resend(resendApiKey);
      for (const email of emails) {
        try {
          const { error: emailError } = await resend.emails.send({
            from: "PawBucks Support <noreply@pawbucks.app>",
            to: [email.to],
            subject: email.subject,
            html: email.html,
          });
          if (emailError) {
            console.error(`Email to ${email.to} failed:`, emailError);
          } else {
            console.log(`Email sent to ${email.to}`);
          }
        } catch (emailErr) {
          console.error(`Email send error:`, emailErr instanceof Error ? emailErr.message : emailErr);
        }
      }
    } else if (!resendApiKey) {
      console.warn("RESEND_API_KEY not set — skipping emails");
    }

    return new Response(
      JSON.stringify({ success: true, notifications: notifications.length, emails: emails.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Support ticket notification error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
