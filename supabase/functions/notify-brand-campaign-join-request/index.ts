import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import { Resend } from "https://esm.sh/resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const APP_URL = "https://pawbucks.app";

type EventType = "submitted" | "approved" | "declined";

interface RequestBody {
  requestId: string;
  event: EventType;
}

function shell(opts: {
  headerColor: string;
  headerLabel: string;
  title: string;
  intro: string;
  ctaUrl: string;
  ctaLabel: string;
  extras?: string;
}) {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;background:#f5f5f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 20px;">
    <tr><td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;max-width:600px;box-shadow:0 4px 6px rgba(0,0,0,.1);">
        <tr><td style="background:${opts.headerColor};padding:32px;text-align:center;border-radius:12px 12px 0 0;">
          <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;">
          <p style="margin:8px 0 0;color:#fff;font-size:14px;">${opts.headerLabel}</p>
        </td></tr>
        <tr><td style="padding:40px 32px;">
          <h2 style="color:#1f2937;margin:0 0 16px;font-size:22px;">${opts.title}</h2>
          <p style="color:#374151;font-size:16px;line-height:1.6;margin:0 0 16px;">${opts.intro}</p>
          ${opts.extras || ""}
          <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:16px 0 8px;">
            <a href="${opts.ctaUrl}" style="background:${opts.headerColor};color:#fff;text-decoration:none;padding:14px 32px;border-radius:8px;font-weight:600;display:inline-block;">${opts.ctaLabel}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;
}

function quoteBlock(label: string, body: string) {
  return `<div style="margin:0 0 20px;padding:12px 16px;border-left:3px solid #7DD4D4;background:#f9fafb;border-radius:4px;">
    <p style="margin:0 0 4px;color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:.04em;">${label}</p>
    <p style="margin:0;color:#374151;font-size:14px;font-style:italic;line-height:1.5;">"${body.replace(/</g, "&lt;")}"</p>
  </div>`;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userError } = await supabase.auth.getUser(
      authHeader.replace("Bearer ", ""),
    );
    if (userError || !userData.user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json()) as RequestBody;
    if (!body?.requestId || !body?.event || !["submitted", "approved", "declined"].includes(body.event)) {
      return new Response(JSON.stringify({ error: "requestId and valid event required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: joinReq, error: joinErr } = await supabase
      .from("brand_campaign_join_requests")
      .select(`
        id, status, message, response_message, requested_at, responded_at,
        merchants:merchant_id ( id, business_name, owner_id, contact_email, logo_url ),
        brand_campaigns:campaign_id (
          id, name, campaign_color,
          brand_accounts:brand_id ( id, brand_name, contact_email, contact_name, user_id )
        )
      `)
      .eq("id", body.requestId)
      .maybeSingle();

    if (joinErr || !joinReq) {
      console.error("Join request lookup failed", joinErr);
      return new Response(JSON.stringify({ error: "Join request not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const merchant = (joinReq as any).merchants;
    const campaign = (joinReq as any).brand_campaigns;
    const brand = campaign?.brand_accounts;

    let merchantEmail: string | null = merchant?.contact_email || null;
    if (!merchantEmail && merchant?.owner_id) {
      const { data: p } = await supabase
        .from("profiles").select("email").eq("user_id", merchant.owner_id).maybeSingle();
      merchantEmail = p?.email || null;
    }
    let brandEmail: string | null = brand?.contact_email || null;
    if (!brandEmail && brand?.user_id) {
      const { data: p } = await supabase
        .from("profiles").select("email").eq("user_id", brand.user_id).maybeSingle();
      brandEmail = p?.email || null;
    }

    const headerColor = campaign?.campaign_color || "#7DD4D4";
    const merchantName = merchant?.business_name || "the merchant";
    const brandName = brand?.brand_name || "the brand";
    const campaignName = campaign?.name || "the campaign";

    const sent: { to: string; subject: string }[] = [];

    if (body.event === "submitted") {
      if (!brandEmail) {
        return new Response(JSON.stringify({ success: true, skipped: "brand_email_missing" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const subject = `New campaign join request — ${merchantName} → ${campaignName}`;
      const html = shell({
        headerColor,
        headerLabel: "Brand Campaigns",
        title: `New join request 🐾`,
        intro: `<strong>${merchantName}</strong> has requested to join your campaign <strong>${campaignName}</strong>. Review the request and approve or decline from your Brand dashboard.`,
        extras: joinReq.message ? quoteBlock("Their message", joinReq.message as string) : "",
        ctaUrl: `${APP_URL}/brand-dashboard?tab=requests`,
        ctaLabel: "Review request",
      });
      const { error: sendErr } = await resend.emails.send({
        from: "PawBucks <noreply@pawbucks.app>",
        to: [brandEmail], subject, html,
      });
      if (sendErr) {
        console.error("Resend error (submitted)", sendErr);
        return new Response(JSON.stringify({ error: "Failed to send email", details: sendErr }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sent.push({ to: brandEmail, subject });
    }

    if (body.event === "approved" || body.event === "declined") {
      if (!merchantEmail) {
        return new Response(JSON.stringify({ success: true, skipped: "merchant_email_missing" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const approved = body.event === "approved";
      const subject = approved
        ? `🎉 You're in! ${brandName} approved your join request for ${campaignName}`
        : `Update on your ${campaignName} join request`;
      const html = shell({
        headerColor: approved ? "#10b981" : headerColor,
        headerLabel: "Brand Campaigns",
        title: approved ? `Welcome to ${campaignName}!` : `Your join request was declined`,
        intro: approved
          ? `Great news! <strong>${brandName}</strong> has approved <strong>${merchantName}</strong> to participate in <strong>${campaignName}</strong>. You can start earning branded PawBucks for every qualifying check-in.`
          : `<strong>${brandName}</strong> reviewed your request to join <strong>${campaignName}</strong> and decided not to move forward this time. There are plenty of other open campaigns to explore.`,
        extras: joinReq.response_message ? quoteBlock("Message from the brand", joinReq.response_message as string) : "",
        ctaUrl: `${APP_URL}/merchant-dashboard?tab=brand-campaigns`,
        ctaLabel: approved ? "Open campaign dashboard" : "Browse open campaigns",
      });
      const { error: sendErr } = await resend.emails.send({
        from: "PawBucks <noreply@pawbucks.app>",
        to: [merchantEmail], subject, html,
      });
      if (sendErr) {
        console.error("Resend error (response)", sendErr);
        return new Response(JSON.stringify({ error: "Failed to send email", details: sendErr }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      sent.push({ to: merchantEmail, subject });
    }

    return new Response(JSON.stringify({ success: true, sent }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("notify-brand-campaign-join-request error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
