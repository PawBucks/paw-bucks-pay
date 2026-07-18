import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.2";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Body {
  email: string;
  password: string;
  fullName: string;
  userType: string;
  phone?: string;
  referralCode?: string;
  redirectUrl?: string;
}

function emailHtml(fullName: string, confirmUrl: string) {
  const safeName = fullName ? ` ${fullName.replace(/[<>"']/g, "")}` : "";
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:600px;box-shadow:0 4px 6px rgba(0,0,0,.1);">
        <tr><td style="background:#ffffff;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;">
        </td></tr>
        <tr><td style="padding:40px 32px;">
          <h2 style="color:#1a1a1a;margin:0 0 16px;font-size:24px;font-weight:600;">Welcome to PawBucks${safeName}!</h2>
          <p style="color:#4a4a4a;font-size:16px;line-height:1.6;margin:0 0 24px;">Confirm your email address to activate your account and start earning PawBucks at your favorite pet businesses.</p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${confirmUrl}" style="background:hsl(178,55%,42%);color:#fff;text-decoration:none;padding:16px 40px;border-radius:8px;font-weight:600;display:inline-block;font-size:16px;">Confirm Email</a>
          </td></tr></table>
          <p style="color:#6b7280;font-size:14px;line-height:1.6;margin:0 0 8px;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="color:hsl(178,55%,42%);font-size:12px;word-break:break-all;margin:0;">${confirmUrl}</p>
          <p style="color:#9ca3af;font-size:13px;line-height:1.6;margin:24px 0 0;">If you didn't create a PawBucks account, you can safely ignore this email.</p>
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
    const body = (await req.json()) as Body;
    if (!body?.email || !body?.password || !body?.fullName || !body?.userType) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://pawbucks.app";
    const redirectTo = body.redirectUrl?.startsWith("https://pawbucks.app")
      ? body.redirectUrl
      : `${APP_BASE_URL}/`;

    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { autoRefreshToken: false, persistSession: false } },
    );

    // 1) Create the user WITHOUT sending Supabase's default confirmation email.
    const { data: created, error: createErr } = await admin.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: false,
      user_metadata: {
        full_name: body.fullName,
        user_type: body.userType,
        phone: body.phone || null,
      },
    });

    if (createErr || !created.user) {
      const msg = createErr?.message || "Failed to create account";
      // Return 200 so supabase.functions.invoke surfaces our `error` field
      // instead of a generic "non-2xx status code" message on the client.
      return new Response(JSON.stringify({ success: false, error: msg }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = created.user.id;

    // 2) Generate a signup confirmation link via the Admin API.
    const { data: linkData, error: linkErr } = await admin.auth.admin.generateLink({
      type: "signup",
      email: body.email,
      password: body.password,
      options: { redirectTo },
    });

    if (linkErr || !linkData?.properties?.action_link) {
      console.error("generateLink error", linkErr);
      return new Response(JSON.stringify({ success: false, error: "Failed to generate confirmation link" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const confirmUrl = linkData.properties.action_link;

    // 3) Non-critical: profile upsert + referral.
    try {
      await admin.from("profiles").upsert({
        id: userId,
        user_type: body.userType,
        full_name: body.fullName,
        email: body.email,
        phone: body.phone || null,
      }, { onConflict: "id" });
    } catch (e) { console.warn("profile upsert", e); }

    if (body.referralCode && body.userType === "pet_owner") {
      try {
        const { data: referrer } = await admin
          .from("profiles").select("id").eq("referral_code", body.referralCode).single();
        if (referrer) {
          await admin.from("referrals").insert({
            referrer_id: referrer.id,
            referee_id: userId,
            referral_code: body.referralCode,
          });
        }
      } catch (e) { console.warn("referral", e); }
    }

    // 4) Send the branded confirmation email via Resend.
    const { error: sendErr } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [body.email],
      subject: "Confirm your PawBucks account",
      html: emailHtml(body.fullName, confirmUrl),
    });

    if (sendErr) {
      console.error("Resend error", sendErr);
      // User exists; surface a soft error so client can prompt them to use "Resend".
      return new Response(JSON.stringify({ success: true, userId, emailSent: false }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, userId, emailSent: true }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("send-signup-confirmation error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});