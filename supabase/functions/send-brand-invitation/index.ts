import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://pawbucks.app";

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: must be admin/superadmin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id);
    const isAdmin = (roles || []).some((r) => r.role === "admin" || r.role === "superadmin");
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { brandId } = await req.json();
    if (!brandId || typeof brandId !== "string") {
      return new Response(JSON.stringify({ error: "brandId required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: brand, error: brandErr } = await supabase
      .from("brand_accounts")
      .select("id, brand_name, contact_name, contact_email, invitation_email, invitation_token")
      .eq("id", brandId)
      .single();

    if (brandErr || !brand) {
      return new Response(JSON.stringify({ error: "Brand not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const recipient = brand.invitation_email || brand.contact_email;
    if (!recipient) {
      return new Response(JSON.stringify({ error: "Brand has no contact email" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const inviteUrl = `${APP_URL}/brand-setup/${brand.invitation_token}`;
    const greetName = brand.contact_name ? ` ${brand.contact_name.split(" ")[0]}` : "";

    const html = `
<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:600px;box-shadow:0 4px 6px rgba(0,0,0,.1);">
        <tr><td style="background:#7DD4D4;padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;">
          <p style="margin:8px 0 0;color:#fff;font-size:14px;">Brand Partner Invitation</p>
        </td></tr>
        <tr><td style="padding:40px 32px;">
          <h2 style="color:#1f2937;margin:0 0 16px;font-size:22px;">Welcome to PawBucks${greetName}! 🐾</h2>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">
            <strong>${brand.brand_name}</strong> has been invited to join PawBucks as a Brand Partner.
            You can now fund and run PawBucks campaigns to reach pet owners across our network.
          </p>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 24px;">
            To get started, click below to complete your brand profile. Once setup is complete you'll be able to fund campaigns, target audiences, and track real-time ROI from your Brand Command Center.
          </p>
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:8px 0 24px;">
            <a href="${inviteUrl}" style="background:#7DD4D4;color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;display:inline-block;">Complete Brand Setup</a>
          </td></tr></table>
          <p style="color:#6b7280;font-size:13px;line-height:1.5;margin:0 0 8px;">Or copy this link:</p>
          <p style="color:#7DD4D4;font-size:13px;word-break:break-all;margin:0 0 24px;">${inviteUrl}</p>
          <p style="color:#9ca3af;font-size:12px;line-height:1.5;margin:0;">
            This invitation is unique to your brand. If you weren't expecting this email, you can safely ignore it.
          </p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

    const { error: sendErr } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [recipient],
      subject: `${brand.brand_name} — Complete your PawBucks Brand setup`,
      html,
    });

    if (sendErr) {
      console.error("Resend error", sendErr);
      return new Response(JSON.stringify({ error: "Failed to send email", details: sendErr }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await supabase
      .from("brand_accounts")
      .update({ invitation_sent_at: new Date().toISOString(), invitation_email: recipient })
      .eq("id", brandId);

    return new Response(JSON.stringify({ success: true, sent_to: recipient, invite_url: inviteUrl }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
