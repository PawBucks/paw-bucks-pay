import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const escapeHtml = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
};

const LOGO =
  "https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png";

const EVENT = {
  title: "PetFest 2027",
  date: "Saturday, March 20, 2027",
  time: "10:00 AM – 6:00 PM PT",
  venue: "West Los Angeles Veterans Park",
  city: "West Los Angeles, CA",
  url: "https://pawbucks.app/petfest",
};

function icsContent(rsvpId: string): string {
  const stamp = new Date().toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
  return `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//PawBucks//PetFest//EN
CALSCALE:GREGORIAN
METHOD:PUBLISH
BEGIN:VEVENT
UID:petfest-2027-${rsvpId}@pawbucks.app
DTSTAMP:${stamp}
DTSTART:20270320T170000Z
DTEND:20270321T010000Z
SUMMARY:PetFest 2027 presented by PawBucks
DESCRIPTION:Free one-day pet festival in West LA. Details: ${EVENT.url}
LOCATION:${EVENT.venue}, ${EVENT.city}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
}

function emailHtml(fullName: string, petName: string, petCount: number, petBreed: string | null) {
  const safeName = escapeHtml((fullName || "").split(" ")[0]);
  const safePet = escapeHtml(petName);
  const safeBreed = petBreed ? escapeHtml(petBreed) : "";
  const petLine = `${safePet}${safeBreed ? ` (${safeBreed})` : ""}${
    petCount > 1 ? ` + ${petCount - 1} more pet${petCount - 1 > 1 ? "s" : ""}` : ""
  }`;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:600px;box-shadow:0 4px 6px rgba(0,0,0,.08);">
        <tr><td style="background:#ffffff;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="${LOGO}" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;">
        </td></tr>
        <tr><td style="padding:32px;">
          <h1 style="color:#1a1a1a;margin:0 0 12px;font-size:24px;font-weight:700;">You're on the list${safeName ? `, ${safeName}` : ""}!</h1>
          <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 24px;">Your RSVP for <strong>PetFest 2027</strong> is confirmed. Admission is free — just show up and bring your pet.</p>

          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:10px;margin:0 0 24px;">
            <tr><td style="padding:20px;">
              <p style="margin:0 0 10px;color:#111827;font-size:15px;"><strong>When:</strong> ${EVENT.date}<br><span style="color:#4b5563;">${EVENT.time}</span></p>
              <p style="margin:0 0 10px;color:#111827;font-size:15px;"><strong>Where:</strong> ${EVENT.venue}<br><span style="color:#4b5563;">${EVENT.city}</span></p>
              <p style="margin:0;color:#111827;font-size:15px;"><strong>Admission:</strong> Free</p>
            </td></tr>
          </table>

          <p style="color:#4a4a4a;font-size:15px;line-height:1.6;margin:0 0 24px;"><strong>Attending with:</strong> ${petLine}</p>

          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:0 0 24px;">
            <a href="${EVENT.url}" style="background:hsl(178,55%,42%);color:#fff;text-decoration:none;padding:15px 36px;border-radius:8px;font-weight:600;display:inline-block;font-size:16px;">View Event Details</a>
          </td></tr></table>

          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0;">A calendar invite is attached so you don't forget. We'll email you again closer to the date with the full schedule.</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const email = String(body?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      return new Response(JSON.stringify({ error: "Invalid email" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );

    // Only send when a real RSVP for this address was just created.
    // This prevents the endpoint from being used to email arbitrary addresses.
    const cutoff = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: rsvp, error } = await admin
      .from("petfest_rsvps")
      .select("id, full_name, email, pet_name, pet_breed, pet_count, created_at")
      .ilike("email", email)
      .gte("created_at", cutoff)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!rsvp) {
      return new Response(JSON.stringify({ sent: false, reason: "no_recent_rsvp" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { error: sendErr } = await resend.emails.send({
      from: "PawBucks PetFest <petfest@pawbucks.app>",
      to: [rsvp.email],
      subject: "You're confirmed for PetFest 2027 🐾",
      html: emailHtml(rsvp.full_name, rsvp.pet_name, rsvp.pet_count ?? 1, rsvp.pet_breed),
      attachments: [
        {
          filename: "petfest-2027.ics",
          content: btoa(icsContent(rsvp.id)),
        },
      ],
    });

    if (sendErr) {
      console.error("PetFest RSVP email send failed", sendErr);
      return new Response(JSON.stringify({ sent: false, error: "send_failed" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-petfest-rsvp-confirmation error", err);
    return new Response(JSON.stringify({ sent: false, error: "unexpected" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
