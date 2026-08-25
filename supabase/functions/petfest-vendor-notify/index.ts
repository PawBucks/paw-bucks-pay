import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://pawbucks.app";
const LOGO =
  "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";

const TIER_LABELS: Record<string, string> = {
  tier_1: 'The "Local Pro" Alley',
  tier_2: 'The "Main Street" Marketplace',
  tier_3: 'The "Premium Partner" Pavilion',
};

const bodySchema = z.object({
  applicationId: z.string().uuid(),
  event: z.enum(["received", "decision"]),
  status: z.enum(["approved", "rejected", "waitlisted"]).optional(),
  adminNotes: z.string().max(2000).optional(),
});

const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

function shell(title: string, inner: string) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:600px;box-shadow:0 4px 6px rgba(0,0,0,.08);">
        <tr><td style="background:#ffffff;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="${LOGO}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;">
        </td></tr>
        <tr><td style="padding:32px;">${inner}</td></tr>
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.<br>
          <a href="${APP_URL}/petfest" style="color:#2da89a;text-decoration:none;">pawbucks.app/petfest</a></p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

const detailsTable = (app: Record<string, any>) => `
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 24px;">
    <tr><td style="padding:20px;color:#111827;font-size:15px;line-height:1.7;">
      <strong>Business:</strong> ${escapeHtml(app.business_name)}<br>
      <strong>Tier:</strong> ${escapeHtml(TIER_LABELS[app.tier] ?? app.tier)}<br>
      <strong>Booths:</strong> ${escapeHtml(app.booth_count)}<br>
      <strong>Power needed:</strong> ${app.power_needed ? "Yes" : "No"}
    </td></tr>
  </table>`;

const cta = (label: string, href: string) => `
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 24px;">
    <a href="${href}" style="background:hsl(178,55%,42%);color:#fff;text-decoration:none;padding:15px 36px;border-radius:8px;font-weight:600;display:inline-block;font-size:16px;">${escapeHtml(label)}</a>
  </td></tr></table>`;

function buildEmail(
  kind: "received" | "approved" | "rejected" | "waitlisted",
  app: Record<string, any>,
  adminNotes?: string | null,
) {
  const first = escapeHtml(String(app.contact_name ?? "").split(" ")[0]);
  const hi = first ? `, ${first}` : "";
  const notes = adminNotes
    ? `<p style="color:#4a4a4a;font-size:15px;line-height:1.6;margin:0 0 24px;"><strong>Notes from our team:</strong><br>${escapeHtml(adminNotes)}</p>`
    : "";

  if (kind === "received") {
    return {
      subject: "We received your PetFest 2027 vendor application",
      html: shell(
        "Vendor application received",
        `<h1 style="color:#1a1a1a;margin:0 0 12px;font-size:24px;font-weight:700;">Application received${hi}!</h1>
         <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 24px;">Thanks for applying to exhibit at <strong>PetFest 2027</strong>. Our team reviews every application and will email you with a decision shortly.</p>
         ${detailsTable(app)}
         ${cta("View PetFest Details", `${APP_URL}/petfest`)}
         <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">Need to change something on your application? Just reply to this email.</p>`,
      ),
    };
  }

  if (kind === "approved") {
    return {
      subject: "You're in — PetFest 2027 vendor application approved",
      html: shell(
        "Vendor application approved",
        `<h1 style="color:#1a1a1a;margin:0 0 12px;font-size:24px;font-weight:700;">You're approved${hi}!</h1>
         <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 24px;">Your vendor application for <strong>PetFest 2027</strong> has been approved. We'll follow up with booth assignment, load-in times, and payment details.</p>
         ${detailsTable(app)}
         ${notes}
         ${cta("View PetFest Details", `${APP_URL}/petfest`)}`,
      ),
    };
  }

  if (kind === "waitlisted") {
    return {
      subject: "Your PetFest 2027 vendor application is waitlisted",
      html: shell(
        "Vendor application waitlisted",
        `<h1 style="color:#1a1a1a;margin:0 0 12px;font-size:24px;font-weight:700;">You're on the waitlist${hi}</h1>
         <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 24px;">Your tier is currently full for <strong>PetFest 2027</strong>. We've placed <strong>${escapeHtml(app.business_name)}</strong> on the waitlist and will reach out the moment a booth opens up.</p>
         ${detailsTable(app)}
         ${notes}
         ${cta("View PetFest Details", `${APP_URL}/petfest`)}`,
      ),
    };
  }

  return {
    subject: "Update on your PetFest 2027 vendor application",
    html: shell(
      "Vendor application update",
      `<h1 style="color:#1a1a1a;margin:0 0 12px;font-size:24px;font-weight:700;">Application update${hi}</h1>
       <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 24px;">Thank you for your interest in exhibiting at <strong>PetFest 2027</strong>. Unfortunately we aren't able to offer <strong>${escapeHtml(app.business_name)}</strong> a booth this year.</p>
       ${notes}
       <p style="color:#4a4a4a;font-size:15px;line-height:1.6;margin:0 0 24px;">We'd love to have you apply again for future events, and you're always welcome to attend.</p>
       ${cta("View PetFest Details", `${APP_URL}/petfest`)}`,
    ),
  };
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const json = (payload: unknown, status = 200) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Authentication required" }, 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Authentication failed" }, 401);

    const parsed = bodySchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: parsed.error.flatten().fieldErrors }, 400);
    const { applicationId, event, status, adminNotes } = parsed.data;

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "", {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: app, error: appErr } = await admin
      .from("petfest_vendor_applications")
      .select("*")
      .eq("id", applicationId)
      .maybeSingle();
    if (appErr) throw appErr;
    if (!app) return json({ error: "Application not found" }, 404);

    let kind: "received" | "approved" | "rejected" | "waitlisted";
    let notes: string | null = null;

    if (event === "received") {
      // Only the applicant may trigger their own confirmation email.
      if (app.user_id !== user.id) return json({ error: "Not allowed" }, 403);
      kind = "received";
    } else {
      const { data: roles } = await userClient
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      const isAdmin = roles?.some((r) => r.role === "admin" || r.role === "superadmin");
      if (!isAdmin) return json({ error: "Admin privileges required" }, 403);
      if (!status) return json({ error: "status is required for a decision" }, 400);

      const { error: updErr } = await admin
        .from("petfest_vendor_applications")
        .update({
          status,
          admin_notes: adminNotes ?? app.admin_notes ?? null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", applicationId);
      if (updErr) throw updErr;

      kind = status;
      notes = adminNotes ?? null;

      const title =
        status === "approved"
          ? "PetFest vendor application approved"
          : status === "waitlisted"
            ? "PetFest vendor application waitlisted"
            : "PetFest vendor application update";
      await admin.from("notifications").insert({
        user_id: app.user_id,
        title,
        message:
          status === "approved"
            ? `${app.business_name} is confirmed as a PetFest 2027 vendor. Check your email for next steps.`
            : status === "waitlisted"
              ? `${app.business_name} is on the PetFest 2027 vendor waitlist. We'll notify you if a booth opens.`
              : `Your PetFest 2027 vendor application for ${app.business_name} was not approved this year.`,
        category: "petfest_vendor",
        link_url: "/petfest/vendors",
      });
    }

    const recipient = String(app.email ?? "").trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
      return json({ sent: false, reason: "invalid_recipient" });
    }

    const { subject, html } = buildEmail(kind, app, notes ?? app.admin_notes);
    const { error: sendErr } = await resend.emails.send({
      from: "PawBucks PetFest <petfest@pawbucks.app>",
      to: [recipient],
      subject,
      html,
    });
    if (sendErr) {
      console.error("petfest-vendor-notify send failed", sendErr);
      return json({ sent: false, error: "send_failed" });
    }

    return json({ sent: true, status: event === "decision" ? status : "pending" });
  } catch (err) {
    console.error("petfest-vendor-notify error", err);
    return json({ error: "unexpected" }, 500);
  }
});
