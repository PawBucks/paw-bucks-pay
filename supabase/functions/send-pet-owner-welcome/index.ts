import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  userId?: string;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]!));
}

function tierMeta(tier: string): { label: string; rate: number } {
  const t = (tier || "").toLowerCase();
  if (["pawpass_plus", "plus", "premium", "pawpass+"].some((x) => t.includes(x))) {
    return { label: "PawPass+", rate: 30 };
  }
  if (["pawpass", "basic"].some((x) => t === x || t.includes(x))) {
    return { label: "PawPass", rate: 20 };
  }
  return { label: "Free", rate: 10 };
}

function emailHtml(firstName: string, tier: string, rate: number, email: string) {
  const name = esc(firstName || "there");
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Welcome to PawBucks, ${name}!</title></head>
<body style="margin:0;padding:0;background:#f4f7f8;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Inter',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:580px;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(10,31,38,0.10);">
  <tr><td style="background:linear-gradient(145deg,#0a1f26 0%,#0e3040 60%,#0a8f9a 100%);padding:44px 36px 36px;text-align:center;">
    <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="96" height="96" style="display:block;margin:0 auto 18px;">
    <h1 style="color:#ffffff;font-size:28px;font-weight:800;margin:0 0 12px;letter-spacing:-0.03em;line-height:1.2;">Welcome to PawBucks,<br>${name}!</h1>
    <p style="color:#6ab8c0;font-size:15px;line-height:1.65;margin:0 0 28px;">You've just joined the smarter way to discover,<br>pay for, and save on local pet care.</p>
    <div style="display:inline-block;background:rgba(18,168,179,0.18);border:1px solid rgba(18,168,179,0.4);border-radius:999px;padding:7px 20px;margin-bottom:8px;">
      <span style="color:#5eeaf2;font-size:13px;font-weight:700;letter-spacing:0.04em;">You earn <strong style="color:#ffffff;">${rate}x PawBucks</strong> on every $1 you spend</span>
    </div>
    <p style="color:rgba(255,255,255,0.4);font-size:11px;margin:6px 0 0;">${esc(tier)} plan &nbsp;·&nbsp; Upgrade anytime for up to 30x rewards</p>
  </td></tr>

  <tr><td style="padding:0;background:#f8f9fa;border-bottom:1px solid #e8edf2;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
      <td style="padding:18px 0;text-align:center;border-right:1px solid #e8edf2;" width="33%">
        <div style="font-size:22px;font-weight:800;color:#12a8b3;letter-spacing:-0.02em;">1,000</div>
        <div style="font-size:11px;color:#94a3b8;font-weight:500;margin-top:3px;">PawBucks = $1</div>
      </td>
      <td style="padding:18px 0;text-align:center;border-right:1px solid #e8edf2;" width="33%">
        <div style="font-size:22px;font-weight:800;color:#12a8b3;letter-spacing:-0.02em;">${rate}x</div>
        <div style="font-size:11px;color:#94a3b8;font-weight:500;margin-top:3px;">Your earn rate</div>
      </td>
      <td style="padding:18px 0;text-align:center;" width="33%">
        <div style="font-size:22px;font-weight:800;color:#12a8b3;letter-spacing:-0.02em;">$0</div>
        <div style="font-size:11px;color:#94a3b8;font-weight:500;margin-top:3px;">To join</div>
      </td>
    </tr></table>
  </td></tr>

  <tr><td style="padding:36px 36px 0;">
    <p style="color:#475569;font-size:15px;line-height:1.75;margin:0 0 28px;">Hi ${name}, welcome aboard! PawBucks works with two types of pet care providers — and understanding the difference will help you get the most out of the platform. Here's how it all works.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#e8f9fa;border-radius:12px;margin-bottom:28px;"><tr><td style="padding:22px 24px;">
      <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#0a8f9a;margin:0 0 6px;">How PawBucks Works</p>
      <h2 style="font-size:18px;font-weight:800;color:#0f172a;margin:0 0 10px;letter-spacing:-0.01em;">The simple version</h2>
      <p style="font-size:13px;color:#475569;line-height:1.7;margin:0;">Every time you make a transaction through PawBucks — at any participating provider — you earn PawBucks rewards. Collect enough and they turn into real savings. 1,000 PawBucks = $1 off a future visit. The more you use the platform, the more you save.</p>
    </td></tr></table>

    <h2 style="font-size:19px;font-weight:800;color:#0f172a;margin:0 0 6px;letter-spacing:-0.02em;">Two types of providers</h2>
    <p style="font-size:13px;color:#94a3b8;margin:0 0 22px;line-height:1.6;">PawBucks has two distinct types of merchants and vets on the platform. Here's what each one means for you.</p>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1.5px solid #99f0ea;border-radius:14px;overflow:hidden;margin-bottom:16px;"><tr>
      <td style="width:5px;background:linear-gradient(180deg,#12a8b3,#0a8f9a);padding:0;"></td>
      <td style="padding:22px 22px 22px 18px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:12px;"><tr><td style="background:#12a8b3;border-radius:999px;padding:4px 12px;"><span style="font-size:10px;font-weight:700;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase;">PawBucks Partners</span></td></tr></table>
        <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0 0 8px;letter-spacing:-0.01em;">Pay, earn, and save — all in one place</h3>
        <p style="font-size:13px;color:#475569;line-height:1.7;margin:0 0 16px;">PawBucks Partners are fully integrated with PawBucks. You pay them directly through the platform, earn PawBucks on every dollar you spend, and redeem your rewards on future visits. This is the full PawBucks experience.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f0fdfb;border-radius:10px;"><tr><td style="padding:14px 16px;">
          <p style="font-size:11px;font-weight:700;color:#0a8f9a;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 10px;">How to use it</p>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:8px;"><tr>
            <td style="vertical-align:top;padding-right:10px;"><div style="width:22px;height:22px;border-radius:50%;background:#12a8b3;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:22px;">1</div></td>
            <td style="vertical-align:top;"><p style="font-size:13px;color:#0f172a;font-weight:600;margin:0 0 1px;line-height:22px;">Find a PawBucks Partner</p><p style="font-size:12px;color:#475569;margin:0;">Look for the <strong style="color:#12a8b3;">PawBucks Accepted</strong> badge in the directory.</p></td>
          </tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:8px;"><tr>
            <td style="vertical-align:top;padding-right:10px;"><div style="width:22px;height:22px;border-radius:50%;background:#12a8b3;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:22px;">2</div></td>
            <td style="vertical-align:top;"><p style="font-size:13px;color:#0f172a;font-weight:600;margin:0 0 1px;line-height:22px;">Pay through PawBucks</p><p style="font-size:12px;color:#475569;margin:0;">Use your card, your PawBucks balance, or a mix of both at checkout.</p></td>
          </tr></table>
          <table role="presentation" cellspacing="0" cellpadding="0"><tr>
            <td style="vertical-align:top;padding-right:10px;"><div style="width:22px;height:22px;border-radius:50%;background:#12a8b3;color:#fff;font-size:11px;font-weight:700;text-align:center;line-height:22px;">3</div></td>
            <td style="vertical-align:top;"><p style="font-size:13px;color:#0f172a;font-weight:600;margin:0 0 1px;line-height:22px;">Earn ${rate}x PawBucks automatically</p><p style="font-size:12px;color:#475569;margin:0;">Rewards are credited to your wallet after every transaction. They add up fast.</p></td>
          </tr></table>
        </td></tr></table>
      </td></tr></table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border:1.5px solid #d4a017;border-radius:14px;overflow:hidden;margin-bottom:28px;"><tr>
      <td style="width:5px;background:linear-gradient(180deg,#d4a017,#b8860b);padding:0;"></td>
      <td style="padding:22px 22px 22px 18px;">
        <table role="presentation" cellspacing="0" cellpadding="0" style="margin-bottom:12px;"><tr><td style="background:linear-gradient(135deg,#d4a017,#b8860b);border-radius:999px;padding:4px 12px;"><span style="font-size:10px;font-weight:700;color:#ffffff;letter-spacing:0.1em;text-transform:uppercase;">New Customer Deal</span></td></tr></table>
        <h3 style="font-size:16px;font-weight:800;color:#0f172a;margin:0 0 8px;letter-spacing:-0.01em;">Exclusive deals for first-time visits</h3>
        <p style="font-size:13px;color:#475569;line-height:1.7;margin:0 0 16px;">New Customer providers don't accept PawBucks as payment and don't offer rewards on purchases — but they offer something just as valuable: <strong style="color:#0f172a;">exclusive first-visit deals</strong> that are only unlocked by scanning their unique QR code in person.</p>
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#fffbeb;border-radius:10px;"><tr><td style="padding:14px 16px;">
          <p style="font-size:11px;font-weight:700;color:#b8860b;letter-spacing:0.1em;text-transform:uppercase;margin:0 0 10px;">How to unlock</p>
          <p style="font-size:13px;color:#0f172a;font-weight:600;margin:0 0 4px;">Walk in &amp; scan the merchant's QR code</p>
          <p style="font-size:12px;color:#475569;margin:0;">One-time deal per merchant. New customers only. Available on your first visit.</p>
        </td></tr></table>
      </td></tr></table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(145deg,#0a1f26,#0e3040);border-radius:14px;margin-bottom:28px;"><tr><td style="padding:24px;text-align:center;">
      <p style="font-size:10px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;color:#5eeaf2;margin:0 0 6px;">Earn More Per Dollar</p>
      <h3 style="font-size:18px;font-weight:800;color:#ffffff;margin:0 0 14px;letter-spacing:-0.01em;">Upgrade to PawPass or PawPass+</h3>
      <table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 auto 18px;"><tr>
        <td style="padding:0 12px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#ffffff;">10x</div><div style="font-size:10px;color:#6ab8c0;">Free</div></td>
        <td style="padding:0 12px;text-align:center;border-left:1px solid rgba(255,255,255,0.1);border-right:1px solid rgba(255,255,255,0.1);"><div style="font-size:20px;font-weight:800;color:#5eeaf2;">20x</div><div style="font-size:10px;color:#6ab8c0;">PawPass</div></td>
        <td style="padding:0 12px;text-align:center;"><div style="font-size:20px;font-weight:800;color:#5eeaf2;">30x</div><div style="font-size:10px;color:#6ab8c0;">PawPass+</div></td>
      </tr></table>
      <a href="https://pawbucks.app/profile#pawpass" style="display:inline-block;background:#12a8b3;color:#ffffff;text-decoration:none;padding:12px 24px;border-radius:9px;font-size:13px;font-weight:700;">Upgrade My Plan →</a>
    </td></tr></table>

    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:28px;"><tr><td align="center">
      <a href="https://pawbucks.app/directory" style="display:inline-block;background:#12a8b3;color:#ffffff;text-decoration:none;padding:15px 40px;border-radius:11px;font-size:15px;font-weight:700;letter-spacing:-0.01em;">Explore Pet Services Near Me</a>
      <p style="font-size:12px;color:#94a3b8;margin:10px 0 0;">Verified local pet care providers — groomers, vets, trainers, boarders, and more.</p>
    </td></tr></table>
  </td></tr>

  <tr><td style="background:#f9fafb;border-top:1px solid #e8edf2;padding:22px 36px;text-align:center;">
    <p style="color:#9ca3af;font-size:11px;line-height:1.7;margin:0 0 6px;">Sent to ${esc(email)} &nbsp;·&nbsp; Questions? <a href="mailto:support@pawbucks.app" style="color:#12a8b3;text-decoration:none;">support@pawbucks.app</a></p>
    <p style="color:#9ca3af;font-size:11px;margin:0;">© ${new Date().getFullYear()} PawBucks, Inc. &nbsp;·&nbsp; You're receiving this because you just created an account.</p>
  </td></tr>
</table>
</td></tr></table>
</body></html>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = (await req.json().catch(() => ({}))) as Body;
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // Resolve user — either explicit userId or from caller's JWT
    let userId = body.userId;
    if (!userId) {
      const authHeader = req.headers.get("Authorization") ?? "";
      const token = authHeader.replace(/^Bearer\s+/i, "");
      if (token) {
        const { data: u } = await admin.auth.getUser(token);
        userId = u?.user?.id;
      }
    }

    if (!userId) {
      return new Response(JSON.stringify({ error: "Missing userId" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("id, email, full_name, user_type, welcome_email_sent_at")
      .eq("id", userId)
      .maybeSingle();

    if (profileErr || !profile) {
      return new Response(JSON.stringify({ error: "Profile not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.user_type !== "pet_owner") {
      return new Response(JSON.stringify({ skipped: "not_pet_owner" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (profile.welcome_email_sent_at) {
      return new Response(JSON.stringify({ skipped: "already_sent" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!profile.email) {
      return new Response(JSON.stringify({ error: "No email on profile" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Look up active subscription tier (defaults to Free)
    let tier = "free";
    try {
      const { data: sub } = await admin
        .from("subscriptions")
        .select("subscription_tier, status")
        .eq("user_id", userId)
        .eq("status", "active")
        .maybeSingle();
      if (sub?.subscription_tier) tier = sub.subscription_tier;
    } catch (_) { /* table may not exist or be readable; default to free */ }

    const { label, rate } = tierMeta(tier);
    const firstName = (profile.full_name || "").split(" ")[0] || "";

    const { error: sendErr } = await resend.emails.send({
      from: "PawBucks <welcome@pawbucks.app>",
      to: [profile.email],
      subject: `Welcome to PawBucks${firstName ? `, ${firstName}` : ""}!`,
      html: emailHtml(firstName, label, rate, profile.email),
    });

    if (sendErr) {
      console.error("Resend error", sendErr);
      return new Response(JSON.stringify({ error: "Failed to send email" }), {
        status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin
      .from("profiles")
      .update({ welcome_email_sent_at: new Date().toISOString() })
      .eq("id", userId);

    return new Response(JSON.stringify({ success: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-pet-owner-welcome error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});