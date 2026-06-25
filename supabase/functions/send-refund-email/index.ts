import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { checkInternalSecret } from "../_shared/internal-auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

interface Body {
  email: string;
  customerName?: string | null;
  merchantName: string;
  refundAmount: number;
  isFullRefund: boolean;
  originalAmount: number;
  earnedReversed?: number;
  spentReturned?: number;
  transactionId: string;
  reason?: string;
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}

function reasonLabel(r?: string) {
  switch (r) {
    case "duplicate": return "Duplicate charge";
    case "fraudulent": return "Fraudulent charge";
    default: return "Requested by customer";
  }
}

function buildHtml(d: Body) {
  const primary = "#36a39c";
  const greeting = d.customerName ? `Hi ${escapeHtml(d.customerName.split(" ")[0])},` : "Hi there,";
  const headline = d.isFullRefund ? "Your refund has been issued" : "A partial refund has been issued";
  const merchant = escapeHtml(d.merchantName);
  const usd = (n: number) => `$${n.toFixed(2)}`;
  const pbRows: string[] = [];
  if (d.earnedReversed && d.earnedReversed > 0) {
    pbRows.push(`<tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">PawBucks earned reversed</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">−${d.earnedReversed.toLocaleString()} PB</td></tr>`);
  }
  if (d.spentReturned && d.spentReturned > 0) {
    pbRows.push(`<tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">PawBucks returned to wallet</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:${primary};text-align:right;border-bottom:1px solid #f3f4f6;">+${d.spentReturned.toLocaleString()} PB</td></tr>`);
  }

  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;max-width:600px;">
        <tr><td style="padding:32px 32px 0 32px;text-align:center;">
          <div style="font-size:24px;font-weight:700;color:${primary};">PawBucks</div>
        </td></tr>
        <tr><td style="padding:24px 32px 8px 32px;">
          <h1 style="margin:0 0 8px 0;font-size:22px;font-weight:700;color:#1f2937;text-align:center;">${headline}</h1>
          <p style="margin:0 0 24px 0;font-size:14px;color:#6b7280;text-align:center;line-height:1.5;">${greeting} ${merchant} has issued ${d.isFullRefund ? "a full" : "a partial"} refund on your purchase.</p>
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;border:1px solid #e5e7eb;margin-bottom:16px;">
            <tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Original purchase</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;border-bottom:1px solid #f3f4f6;">${usd(d.originalAmount)}</td></tr>
            <tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;border-bottom:1px solid #f3f4f6;">Refund amount</td><td style="padding:12px 16px;font-size:16px;font-weight:700;color:${primary};text-align:right;border-bottom:1px solid #f3f4f6;">${usd(d.refundAmount)}</td></tr>
            ${pbRows.join("")}
            <tr><td style="padding:12px 16px;font-size:14px;color:#6b7280;">Reason</td><td style="padding:12px 16px;font-size:14px;font-weight:600;color:#1f2937;text-align:right;">${escapeHtml(reasonLabel(d.reason))}</td></tr>
          </table>
          <p style="margin:0 0 24px 0;font-size:13px;color:#6b7280;line-height:1.5;">Refunds typically appear on your statement within 5–10 business days, depending on your card issuer.</p>
          <p style="margin:24px 0 0 0;font-size:12px;color:#9ca3af;text-align:center;">Reference: ${escapeHtml(d.transactionId.slice(0, 8))}</p>
        </td></tr>
        <tr><td style="background:#f9fafb;padding:24px 32px;text-align:center;border-radius:0 0 12px 12px;border-top:1px solid #e5e7eb;">
          <p style="color:#9ca3af;font-size:12px;margin:0;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
        </td></tr>
      </table>
    </td></tr>
  </table></body></html>`;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const authError = await checkInternalSecret(req, corsHeaders);
  if (authError) return authError;
  try {
    const apiKey = Deno.env.get("RESEND_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "Email service not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const data = (await req.json()) as Body;
    if (!data?.email || !data?.merchantName || typeof data?.refundAmount !== "number") {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const resend = new Resend(apiKey);
    const subject = data.isFullRefund
      ? `Refund issued: $${data.refundAmount.toFixed(2)} from ${data.merchantName}`
      : `Partial refund: $${data.refundAmount.toFixed(2)} from ${data.merchantName}`;
    const result = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: data.email,
      subject,
      html: buildHtml(data),
    });
    return new Response(JSON.stringify({ success: true, id: result.data?.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200,
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    console.error("[send-refund-email] error", msg);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});