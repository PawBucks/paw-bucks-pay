import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { checkInternalSecret } from "../_shared/internal-auth.ts";
import { currentHourInTz } from "../_shared/tz.ts";
import { escapeHtml } from "../_shared/escape-html.ts";

const TARGET_LOCAL_HOUR = 9; // 9 AM in each recipient's timezone

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

type Milestone = "upcoming_14" | "upcoming_7" | "upcoming_1" | "overdue";

const MILESTONES: { key: Milestone; daysFromToday: number; label: string }[] = [
  { key: "upcoming_14", daysFromToday: 14, label: "in 14 days" },
  { key: "upcoming_7", daysFromToday: 7, label: "in 7 days" },
  { key: "upcoming_1", daysFromToday: 1, label: "tomorrow" },
  { key: "overdue", daysFromToday: 0, label: "overdue" },
];

function todayInTz(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function addDaysISO(yyyyMmDd: string, days: number): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

function formatLocalDate(yyyyMmDd: string): string {
  const [y, m, d] = yyyyMmDd.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });
}

function buildEmailHtml(petName: string, vaccineName: string, dueDate: string, milestone: Milestone, shareUrl: string | null): string {
  const petNameEsc = escapeHtml(petName);
  const vaccineNameEsc = escapeHtml(vaccineName);
  const isOverdue = milestone === "overdue";
  const headline = isOverdue
    ? `${petNameEsc}'s ${vaccineNameEsc} vaccine is overdue`
    : `${petNameEsc}'s ${vaccineNameEsc} vaccine is due ${MILESTONES.find(m => m.key === milestone)?.label}`;
  const accent = isOverdue ? "#dc2626" : "#0d9488";
  return `
  <div style="font-family:-apple-system,Segoe UI,Roboto,sans-serif;max-width:560px;margin:0 auto;background:#fff;color:#111">
    <div style="background:linear-gradient(135deg,${accent},${accent}cc);padding:28px;color:#fff;border-radius:14px 14px 0 0">
      <div style="font-size:12px;letter-spacing:1.5px;text-transform:uppercase;opacity:.85">PawBucks · Pet Health</div>
      <h1 style="margin:8px 0 0;font-size:22px;line-height:1.3">${headline}</h1>
    </div>
    <div style="padding:24px;border:1px solid #eee;border-top:none;border-radius:0 0 14px 14px">
      <p style="margin:0 0 14px;font-size:15px">Hi there — this is a friendly reminder from PawBucks about <strong>${petNameEsc}</strong>.</p>
      <table style="width:100%;border-collapse:collapse;margin:12px 0">
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Vaccine</td><td style="padding:6px 0;font-weight:600">${vaccineNameEsc}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280;font-size:13px">Due date</td><td style="padding:6px 0;font-weight:600;color:${accent}">${formatLocalDate(dueDate)}</td></tr>
      </table>
      <p style="font-size:14px;color:#374151">${isOverdue
        ? "Please book a booster appointment with your vet as soon as possible to keep their records current."
        : "Schedule a booster with your vet to keep their Digital Pet ID up to date."}</p>
      ${shareUrl ? `<div style="margin:20px 0"><a href="${shareUrl}" style="background:${accent};color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">View Digital Pet ID</a></div>` : ""}
      <p style="font-size:12px;color:#9ca3af;margin-top:24px">You're receiving this because vaccination reminders are enabled for your account.</p>
    </div>
  </div>`;
}

function buildSmsBody(petName: string, vaccineName: string, dueDate: string, milestone: Milestone): string {
  if (milestone === "overdue") {
    return `PawBucks: ${petName}'s ${vaccineName} vaccine is OVERDUE (was due ${formatLocalDate(dueDate)}). Book a booster soon to keep records current.`;
  }
  const label = MILESTONES.find(m => m.key === milestone)?.label || "soon";
  return `PawBucks: ${petName}'s ${vaccineName} vaccine is due ${label} (${formatLocalDate(dueDate)}). Schedule with your vet to stay current.`;
}

async function sendEmail(to: string, subject: string, html: string, resendKey: string): Promise<boolean> {
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${resendKey}` },
      body: JSON.stringify({
        from: "PawBucks Health <health@pawbucks.app>",
        to: [to],
        subject,
        html,
      }),
    });
    return res.ok;
  } catch (e) {
    console.error("[email] error", e);
    return false;
  }
}

async function sendSms(to: string, body: string, sid: string, token: string, from: string): Promise<boolean> {
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${btoa(`${sid}:${token}`)}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ To: to, From: from, Body: body }).toString(),
    });
    return res.ok;
  } catch (e) {
    console.error("[sms] error", e);
    return false;
  }
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const _authResp = await checkInternalSecret(req, corsHeaders);
  if (_authResp) return _authResp;

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  const twilioSid = Deno.env.get("TWILIO_ACCOUNT_SID") || "";
  const twilioToken = Deno.env.get("TWILIO_AUTH_TOKEN") || "";
  const twilioFrom = Deno.env.get("TWILIO_PHONE_NUMBER") || "";
  const supabase = createClient(supabaseUrl, serviceKey);

  // Build target date set: YYYY-MM-DD for each upcoming milestone (overdue handled with range)
  const targetDates = new Map<string, Milestone>(); // date → milestone
  const todayUtc = todayInTz("UTC");
  for (const ms of MILESTONES) {
    if (ms.key !== "overdue") {
      targetDates.set(addDaysISO(todayUtc, ms.daysFromToday), ms.key);
    }
  }

  // Pull vaccinations whose next_due_date is overdue today or matches an upcoming milestone (within 14 days)
  const fourteenAhead = addDaysISO(todayUtc, 14);
  const { data: vaccinations, error: vaxErr } = await supabase
    .from("pet_vaccinations")
    .select("id, pet_id, vaccine_name, next_due_date")
    .not("next_due_date", "is", null)
    .lte("next_due_date", fourteenAhead);
  if (vaxErr) {
    console.error("vax fetch error", vaxErr);
    return new Response(JSON.stringify({ error: vaxErr.message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }

  let processed = 0, emailsSent = 0, smsSent = 0, inAppSent = 0, skipped = 0;

  for (const v of vaccinations || []) {
    const dueStr: string = (v.next_due_date as string).slice(0, 10);
    let milestone: Milestone | null = null;
    if (dueStr < todayUtc) milestone = "overdue";
    else if (targetDates.has(dueStr)) milestone = targetDates.get(dueStr)!;
    if (!milestone) { skipped++; continue; }

    // Pet + owner
    const { data: pet } = await supabase
      .from("pet_profiles")
      .select("id, name, user_id, digital_id_token")
      .eq("id", v.pet_id)
      .maybeSingle();
    if (!pet?.user_id) { skipped++; continue; }

    const { data: profile } = await supabase
      .from("profiles")
      .select("email, phone, full_name, timezone")
      .eq("id", pet.user_id)
      .maybeSingle();

    // Per-user timezone gate: only fire at TARGET_LOCAL_HOUR in the
    // recipient's local time. Cron fires hourly, so each user gets exactly
    // one window per day. Defaults to ET if no timezone is set.
    const userHour = currentHourInTz(profile?.timezone);
    if (userHour !== TARGET_LOCAL_HOUR) { skipped++; continue; }

    const { data: prefs } = await supabase
      .from("notification_preferences")
      .select("transactional, delivery_method")
      .eq("user_id", pet.user_id)
      .maybeSingle();

    // Default ON if no prefs row
    const optedIn = prefs ? prefs.transactional !== false : true;
    if (!optedIn) { skipped++; continue; }
    const method = prefs?.delivery_method || "in_app"; // 'in_app' | 'email' | 'sms' | 'all'

    const channels: ("email" | "sms" | "in_app")[] = [];
    if (method === "all" || method === "email") channels.push("email");
    if (method === "all" || method === "sms") channels.push("sms");
    if (method === "all" || method === "in_app") channels.push("in_app");
    if (channels.length === 0) channels.push("in_app");

    processed++;
    const shareUrl = pet.digital_id_token ? `https://pawbucks.app/pet-id/public/${pet.digital_id_token}` : null;
    const subject = milestone === "overdue"
      ? `${pet.name}'s ${v.vaccine_name} is overdue`
      : `${pet.name}'s ${v.vaccine_name} vaccine — due ${MILESTONES.find(m => m.key === milestone)?.label}`;

    for (const channel of channels) {
      // Idempotency: skip if already logged
      const { data: existing } = await supabase
        .from("vaccine_reminder_log")
        .select("id")
        .eq("vaccination_id", v.id)
        .eq("milestone", milestone)
        .eq("channel", channel)
        .maybeSingle();
      if (existing) continue;

      let ok = false;
      if (channel === "email" && profile?.email && resendKey) {
        ok = await sendEmail(profile.email, subject, buildEmailHtml(pet.name, v.vaccine_name, dueStr, milestone, shareUrl), resendKey);
        if (ok) emailsSent++;
      } else if (channel === "sms" && profile?.phone && twilioSid && twilioToken && twilioFrom) {
        ok = await sendSms(profile.phone, buildSmsBody(pet.name, v.vaccine_name, dueStr, milestone), twilioSid, twilioToken, twilioFrom);
        if (ok) smsSent++;
      } else if (channel === "in_app") {
        const { error: nErr } = await supabase.from("notifications").insert({
          user_id: pet.user_id,
          title: subject,
          message: milestone === "overdue"
            ? `${pet.name}'s ${v.vaccine_name} vaccine was due ${formatLocalDate(dueStr)}. Book a booster soon.`
            : `${pet.name}'s ${v.vaccine_name} vaccine is due ${formatLocalDate(dueStr)}.`,
          category: "vaccine_reminder",
          link_url: `/pet-id/${pet.id}#vax-${v.id}`,
        });
        ok = !nErr;
        if (ok) inAppSent++;
      }

      if (ok) {
        await supabase.from("vaccine_reminder_log").insert({
          user_id: pet.user_id,
          pet_id: pet.id,
          vaccination_id: v.id,
          milestone,
          channel,
          next_due_date: dueStr,
        });
      }
    }
  }

  const summary = { processed, emailsSent, smsSent, inAppSent, skipped, scanned: vaccinations?.length || 0 };
  console.log("[vaccine-reminders]", summary);
  return new Response(JSON.stringify({ success: true, ...summary }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});