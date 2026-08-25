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

function emailHtml(
  fullName: string,
  petName: string,
  petCount: number,
  petBreed: string | null,
  confirmationCode: string,
) {
  const safeName = escapeHtml((fullName || "").split(" ")[0]);
  const safePet = escapeHtml(petName);
  const safeBreed = petBreed ? escapeHtml(petBreed) : "";
  const petLine = `${safePet}${safeBreed ? ` (${safeBreed})` : ""}${
    petCount > 1 ? ` + ${petCount - 1} more pet${petCount - 1 > 1 ? "s" : ""}` : ""
  }`;
  const bunting = (colors: string[]) =>
    colors
      .map(
        (c) =>
          `<td style="background-color:${c}; height:6px; width:16.6%; line-height:6px; font-size:1px;">&nbsp;</td>`,
      )
      .join("");
  return `<!DOCTYPE html>
<html lang="en" xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta http-equiv="X-UA-Compatible" content="IE=edge">
<title>You're on the list for PetFest 2027!</title>
<link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@600;700;800&family=Nunito:wght@400;700;800&display=swap" rel="stylesheet">
<style>
  body, table, td { font-family: 'Nunito', Arial, Helvetica, sans-serif; }
  body { margin:0; padding:0; background-color:#EFE6D0; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
  table { border-collapse:collapse; }
  img { border:0; display:block; }
  a { text-decoration:none; }
  .festive-font { font-family:'Baloo 2', Arial, Helvetica, sans-serif; }
  @media screen and (max-width:600px){
    .container{ width:100% !important; }
    .fluid{ width:100% !important; max-width:100% !important; }
    .stack{ display:block !important; width:100% !important; }
    .px{ padding-left:20px !important; padding-right:20px !important; }
    .h1{ font-size:28px !important; line-height:34px !important; }
  }
</style>
</head>
<body style="margin:0; padding:0; background-color:#EFE6D0;">

<div style="display:none; max-height:0; overflow:hidden; opacity:0; mso-hide:all;">
  You're confirmed for PetFest 2027 — free admission, March 20, West LA Veterans Park. See you there, tails and all. 🐾
</div>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#EFE6D0;">
<tr>
<td align="center" style="padding:24px 12px;">

  <table role="presentation" class="container" width="600" cellpadding="0" cellspacing="0" style="width:600px; max-width:600px; background-color:#F7F1E3;">

    <tr><td style="padding:0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bunting(["#1C8C8C", "#E8475C", "#F4B740", "#6C4C9F", "#EF9233", "#4C9A4C"])}</tr></table>
    </td></tr>

    <tr>
      <td align="center" style="padding:30px 20px 14px; background-color:#F7F1E3;">
        <img src="${LOGO}" width="110" height="110" alt="PawBucks" style="display:block; margin:0 auto;">
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:0 20px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr><td align="center" style="background-color:#F4B740; border:2px solid #1E2A4A; border-radius:100px; padding:8px 22px;">
            <span class="festive-font" style="font-size:13px; font-weight:700; letter-spacing:1px; color:#1E2A4A; text-transform:uppercase;">🎉 You're Confirmed 🎉</span>
          </td></tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" class="px" style="padding:18px 40px 6px;">
        <div class="festive-font h1" style="font-size:36px; line-height:42px; font-weight:700; color:#1E2A4A;">
          You're on the list${safeName ? `, ${safeName}` : ""}! 🐾
        </div>
      </td>
    </tr>
    <tr>
      <td align="center" class="px" style="padding:10px 40px 26px;">
        <div style="font-size:16px; line-height:26px; color:#4a4a40;">
          Your RSVP for <strong style="color:#1E2A4A;">PetFest 2027</strong> is confirmed. Admission is free — just show up, leash in hand, and get ready for the best day on West LA's pet calendar.
        </div>
      </td>
    </tr>

    <tr>
      <td class="px" style="padding:0 30px 24px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:2.5px solid #1E2A4A; border-radius:16px; background-color:#ffffff;">
          <tr>
            <td style="padding:26px 26px 10px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td align="left" class="festive-font" style="font-size:12px; letter-spacing:1.5px; text-transform:uppercase; color:#1C8C8C; font-weight:700;">Admit One · General Admission</td>
                <td align="right" class="festive-font" style="font-size:12px; letter-spacing:1px; color:#8a8474; font-weight:700;">PETFEST 2027</td>
              </tr></table>
            </td>
          </tr>
          <tr><td style="padding:0 26px;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px dashed #D8CCA6; font-size:1px; line-height:1px;">&nbsp;</td></tr></table></td></tr>
          <tr>
            <td style="padding:20px 26px 4px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="26" valign="top" style="font-size:18px; padding-right:10px;">📅</td>
                  <td style="font-size:15px; line-height:22px; color:#2E2A22; padding-bottom:16px;">
                    <strong class="festive-font" style="color:#1E2A4A;">When</strong><br>
                    ${EVENT.date}<br>${EVENT.time}
                  </td>
                </tr>
                <tr>
                  <td width="26" valign="top" style="font-size:18px; padding-right:10px;">📍</td>
                  <td style="font-size:15px; line-height:22px; color:#2E2A22; padding-bottom:16px;">
                    <strong class="festive-font" style="color:#1E2A4A;">Where</strong><br>
                    ${EVENT.venue}<br>${EVENT.city}
                  </td>
                </tr>
                <tr>
                  <td width="26" valign="top" style="font-size:18px; padding-right:10px;">🎟️</td>
                  <td style="font-size:15px; line-height:22px; color:#2E2A22; padding-bottom:16px;">
                    <strong class="festive-font" style="color:#1E2A4A;">Admission</strong><br>Free
                  </td>
                </tr>
                <tr>
                  <td width="26" valign="top" style="font-size:18px; padding-right:10px;">🐕</td>
                  <td style="font-size:15px; line-height:22px; color:#2E2A22;">
                    <strong class="festive-font" style="color:#1E2A4A;">Attending with</strong><br>${petLine}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr><td style="padding:6px 26px 0;"><table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td style="border-top:2px dashed #D8CCA6; font-size:1px; line-height:1px;">&nbsp;</td></tr></table></td></tr>
          <tr>
            <td align="center" style="padding:16px 26px 22px;">
              <span class="festive-font" style="display:inline-block; padding:5px 14px; border:2px dashed #E8475C; border-radius:100px; color:#E8475C; font-weight:700; font-size:12px; letter-spacing:1px; text-transform:uppercase;">Confirmation #${escapeHtml(confirmationCode)}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td class="px" style="padding:0 30px 26px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#DCEFEC; border:2px solid #1E2A4A; border-radius:16px;">
          <tr>
            <td style="padding:20px 22px;">
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
                <td width="42" valign="top" style="font-size:26px; padding-right:12px;">🎁</td>
                <td style="font-size:14.5px; line-height:21px; color:#1E2A4A;">
                  <span class="festive-font" style="font-size:16px; font-weight:700;">Earn up to 15,000 PawBucks</span><br>
                  Complete the PetFest Passport on-site — a stamp at every booth adds up to real rewards you can spend with local partners.
                </td>
              </tr></table>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" style="padding:0 30px 8px;">
        <table role="presentation" cellpadding="0" cellspacing="0">
          <tr>
            <td align="center" style="background-color:#E8475C; border:2.5px solid #1E2A4A; border-radius:100px;">
              <a href="${EVENT.url}" target="_blank" class="festive-font" style="display:inline-block; padding:16px 40px; font-size:16px; font-weight:700; color:#ffffff;">View Event Details →</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <tr>
      <td align="center" class="px" style="padding:20px 50px 8px;">
        <div style="font-size:13.5px; line-height:20px; color:#8a8474;">
          🗓️ A calendar invite is attached so you don't forget. We'll email you again closer to the date with the full schedule and vendor lineup.
        </div>
      </td>
    </tr>

    <tr><td style="padding:28px 0 0;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${bunting(["#4C9A4C", "#EF9233", "#6C4C9F", "#F4B740", "#E8475C", "#1C8C8C"])}</tr></table>
    </td></tr>

    <tr>
      <td align="center" style="padding:26px 30px 34px; background-color:#F7F1E3;">
        <div class="festive-font" style="font-size:13.5px; color:#1E2A4A; font-weight:700; margin-bottom:10px;">
          🐾 PawBucks Presents PetFest &nbsp;·&nbsp; March 20, 2027 &nbsp;·&nbsp; West LA Veterans Park
        </div>
        <div style="font-size:12px; color:#8a8474; line-height:20px;">
          @PawBucksApp &nbsp;·&nbsp; pawbucks.app/petfest &nbsp;·&nbsp; #PawBucksPetFest2027<br>
          © ${new Date().getFullYear()} PawBucks. All rights reserved.
        </div>
      </td>
    </tr>

  </table>

</td>
</tr>
</table>

</body>
</html>`;
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
