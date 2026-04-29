import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

const LOGO_URL = "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";
const APP_URL = "https://pawbucks.app";
const FROM_ADDRESS = "PawBucks <noreply@pawbucks.app>";
const PRIMARY_COLOR = "#2a9d8f";

type Mode = "submitted" | "status_changed";

interface Payload {
  mode: Mode;
  vet_id: string;
  user_id: string | null;
  clinic_name: string | null;
  status?: string | null;
  previous_status?: string | null;
}

function escapeHtml(str: string): string {
  return String(str ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function shell(title: string, intro: string, statusBlock: string, ctaText: string, ctaUrl: string, footerNote: string): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background-color:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:12px;box-shadow:0 4px 6px rgba(0,0,0,0.1);max-width:600px;">
        <tr><td style="background-color:#ffffff;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="${LOGO_URL}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
        </td></tr>
        <tr><td style="padding:0 32px 40px 32px;">
          <h1 style="margin:0 0 12px 0;font-size:22px;font-weight:700;color:#1f2937;text-align:center;">${title}</h1>
          <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;text-align:center;line-height:1.6;">${intro}</p>
          ${statusBlock}
          <table width="100%" cellpadding="0" cellspacing="0" style="margin-top:8px;"><tr><td align="center">
            <a href="${ctaUrl}" target="_blank" style="display:inline-block;background-color:${PRIMARY_COLOR};color:#ffffff;text-decoration:none;font-size:16px;font-weight:600;padding:14px 32px;border-radius:8px;">${ctaText}</a>
          </td></tr></table>
          <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;text-align:center;line-height:1.5;">${footerNote}</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function buildSubmittedHtml(clinicName: string): { subject: string; html: string } {
  const safeName = escapeHtml(clinicName || "your practice");
  const subject = "We received your veterinary onboarding application";
  const intro = `Thanks for applying to join the PawBucks veterinary network. We've received your onboarding application for <strong>${safeName}</strong> and our credentialing team is starting their review.`;
  const statusBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Status</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">Pending Review</td></tr>
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Estimated review time</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">24–48 hours</td></tr>
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;">What's next</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;">Credential verification</td></tr>
    </table>`;
  return {
    subject,
    html: shell(
      "Application Received",
      intro,
      statusBlock,
      "Open your dashboard",
      `${APP_URL}/vet-dashboard`,
      "We'll email you again the moment your status changes.",
    ),
  };
}

function buildStatusChangedHtml(clinicName: string, status: string): { subject: string; html: string } {
  const safeName = escapeHtml(clinicName || "your practice");
  const s = (status || "").toLowerCase();
  let title = "Your application status has changed";
  let intro = `There's an update on your veterinary onboarding application for <strong>${safeName}</strong>.`;
  let badge = status || "Updated";
  let cta = "Open your dashboard";
  let ctaUrl = `${APP_URL}/vet-dashboard`;

  if (s === "approved" || s === "active") {
    title = "You're approved 🎉";
    intro = `Congratulations — <strong>${safeName}</strong> is now an approved PawBucks veterinary partner. You can start accepting patients and processing claim-spliced payments today.`;
    badge = "Approved";
    cta = "Go to dashboard";
  } else if (s === "rejected" || s === "denied") {
    title = "Update on your application";
    intro = `After review, we're unable to approve <strong>${safeName}</strong> at this time. Our team has left notes on what's needed to re-submit.`;
    badge = "Not approved";
    cta = "View details";
  } else if (s === "needs_info" || s === "more_info" || s === "pending_info") {
    title = "We need a little more info";
    intro = `Our credentialing team needs additional information for <strong>${safeName}</strong> before we can finish reviewing your application.`;
    badge = "Action required";
    cta = "Provide info";
    ctaUrl = `${APP_URL}/vet-onboarding`;
  } else if (s === "suspended") {
    title = "Your practice has been suspended";
    intro = `Access for <strong>${safeName}</strong> has been temporarily suspended. Contact support to restore access.`;
    badge = "Suspended";
  }

  const statusBlock = `
    <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:24px;">
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Practice</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">${safeName}</td></tr>
      <tr><td style="padding:14px 18px;font-size:14px;color:#6b7280;">New status</td>
          <td style="padding:14px 18px;font-size:14px;font-weight:600;color:${PRIMARY_COLOR};text-align:right;">${escapeHtml(badge)}</td></tr>
    </table>`;

  return {
    subject: `${title} — PawBucks`,
    html: shell(title, intro, statusBlock, cta, ctaUrl, "Questions? Reply to this email and our partner team will help."),
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Internal-only: require shared secret header so DB triggers (not random callers) invoke this.
    const internalSecret = Deno.env.get("INTERNAL_TRIGGER_SECRET");
    const provided = req.headers.get("x-internal-secret");
    if (!internalSecret || provided !== internalSecret) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json() as Payload;
    if (!body || !body.mode || !body.vet_id) {
      return new Response(JSON.stringify({ error: "missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (body.mode === "status_changed" && body.status && body.previous_status && body.status === body.previous_status) {
      return new Response(JSON.stringify({ skipped: "no status delta" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) throw new Error("RESEND_API_KEY is not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    // Resolve vet email via security-definer helper if available, otherwise fallback to admin auth API.
    let toEmail: string | null = null;
    if (body.user_id) {
      const { data: emailRow } = await supabase.rpc("get_user_email_by_id", { _user_id: body.user_id });
      if (typeof emailRow === "string") toEmail = emailRow;
      if (!toEmail) {
        const { data: u } = await supabase.auth.admin.getUserById(body.user_id);
        toEmail = u?.user?.email ?? null;
      }
    }
    if (!toEmail) {
      // Fallback: contact_email on partner_vets
      const { data: vet } = await supabase
        .from("partner_vets")
        .select("contact_email, clinic_name")
        .eq("id", body.vet_id)
        .maybeSingle();
      toEmail = vet?.contact_email ?? null;
      if (!body.clinic_name && vet?.clinic_name) body.clinic_name = vet.clinic_name;
    }
    if (!toEmail) {
      console.warn("notify-vet-onboarding: no recipient email", { vet_id: body.vet_id });
      return new Response(JSON.stringify({ skipped: "no email" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } =
      body.mode === "submitted"
        ? buildSubmittedHtml(body.clinic_name ?? "")
        : buildStatusChangedHtml(body.clinic_name ?? "", body.status ?? "");

    const resend = new Resend(RESEND_API_KEY);
    const sendRes = await resend.emails.send({
      from: FROM_ADDRESS,
      to: [toEmail],
      subject,
      html,
    });

    if ((sendRes as any)?.error) {
      console.error("Resend error:", (sendRes as any).error);
      return new Response(JSON.stringify({ error: (sendRes as any).error }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-vet-onboarding error:", err);
    const msg = err instanceof Error ? err.message : "unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});