import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header");
    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: authError } = await supabase.auth.getUser(token);
    if (authError || !userData.user) throw new Error("Unauthorized");

    const { invoiceId, changes } = await req.json();
    if (!invoiceId) throw new Error("invoiceId is required");
    const changesList: string[] = Array.isArray(changes) ? changes.filter(Boolean) : [];
    if (changesList.length === 0) {
      return new Response(JSON.stringify({ success: true, skipped: "no_changes" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      });
    }

    const { data: invoice, error: invErr } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();
    if (invErr || !invoice) throw new Error("Invoice not found");

    // Verify the caller owns the merchant on this invoice
    const { data: merchant, error: mErr } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", invoice.merchant_id)
      .eq("user_id", userData.user.id)
      .single();
    if (mErr || !merchant) throw new Error("Unauthorized - merchant not found");

    const { data: extraRecipients } = await supabase
      .from("invoice_recipients")
      .select("*")
      .eq("invoice_id", invoiceId);

    const appUrl = Deno.env.get("APP_URL") || "https://pawbucks.app";
    const invoiceUrl = `${appUrl}/invoice/${invoice.id}/pay?token=${invoice.access_token}`;

    const changesHtml = changesList
      .map(
        (c) =>
          `<li style="padding:6px 0; color:#1a1a1a; font-size:14px; line-height:1.5; border-bottom:1px solid #e6f5f3;">${escapeHtml(c)}</li>`
      )
      .join("");

    const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Invoice updated</title></head>
<body style="margin:0; padding:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Arial, sans-serif; background:#f5f7f7; color:#1a1a1a;">
  <div style="max-width:600px; margin:0 auto; padding:20px;">
    <div style="background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 2px 12px rgba(46,158,143,0.08);">
      <div style="background:linear-gradient(135deg,#2E9E8F 0%,#247d72 100%); padding:28px 24px; text-align:center;">
        <h1 style="margin:0; color:#ffffff; font-size:20px; font-weight:700;">${escapeHtml(merchant.business_name)}</h1>
        <p style="margin:6px 0 0; color:rgba(255,255,255,0.92); font-size:13px;">An invoice was updated</p>
      </div>
      <div style="padding:24px;">
        <p style="margin:0 0 6px; font-size:12px; color:#2E9E8F; text-transform:uppercase; letter-spacing:0.12em; font-weight:600;">Invoice</p>
        <h2 style="margin:0 0 16px; font-size:22px; font-weight:700; color:#1a1a1a;">#${escapeHtml(invoice.invoice_number)}${invoice.title ? ` — ${escapeHtml(invoice.title)}` : ""}</h2>
        <p style="margin:0 0 12px; color:#4a4a4a; font-size:14px; line-height:1.6;">
          Hi ${escapeHtml(invoice.client_name || "there")}, <strong>${escapeHtml(merchant.business_name)}</strong> made changes to your invoice. Here is a summary of what was updated:
        </p>
        <ul style="margin:14px 0; padding:0 0 0 18px; list-style:disc;">${changesHtml}</ul>
        <div style="padding:14px 16px; background:#f7fbfa; border-radius:12px; margin:16px 0;">
          <p style="margin:0; color:#6b7280; font-size:13px;">Current total</p>
          <p style="margin:4px 0 0; font-size:22px; font-weight:800; color:#2E9E8F;">$${Number(invoice.total || 0).toFixed(2)}</p>
          <p style="margin:6px 0 0; color:#6b7280; font-size:12px;">Amount due: $${Number(invoice.amount_due || 0).toFixed(2)}</p>
        </div>
        <div style="text-align:center; margin:22px 0 6px;">
          <a href="${invoiceUrl}" style="display:inline-block; background:linear-gradient(135deg,#2E9E8F 0%,#247d72 100%); color:#ffffff; text-decoration:none; padding:14px 36px; border-radius:12px; font-weight:700; font-size:15px;">View updated invoice →</a>
        </div>
        <p style="margin:18px 0 0; color:#6b7280; font-size:12px; text-align:center;">If you have any questions about these changes, reply to this email or contact ${escapeHtml(merchant.business_name)} directly.</p>
      </div>
      <div style="background:#f7fbfa; padding:18px 24px; text-align:center; border-top:1px solid #e6f5f3;">
        ${merchant.phone ? `<p style="margin:0;"><a href="tel:${escapeHtml(merchant.phone)}" style="color:#2E9E8F; text-decoration:none; font-weight:600; font-size:14px;">${escapeHtml(merchant.phone)}</a></p>` : ""}
        ${merchant.email ? `<p style="margin:4px 0 0;"><a href="mailto:${escapeHtml(merchant.email)}" style="color:#2E9E8F; text-decoration:none; font-size:13px;">${escapeHtml(merchant.email)}</a></p>` : ""}
        <p style="margin:12px 0 0; color:#9ca3af; font-size:12px;">Powered by <a href="https://pawbucks.app" style="color:#2E9E8F; text-decoration:none; font-weight:600;">pawbucks.app</a></p>
      </div>
    </div>
  </div>
</body>
</html>`;

    if (RESEND_API_KEY) {
      const toRecipients = [invoice.client_email].filter(Boolean);
      const ccRecipients = (extraRecipients || [])
        .filter((r: any) => r.recipient_type === "cc")
        .map((r: any) => r.email);
      const bccRecipients = (extraRecipients || [])
        .filter((r: any) => r.recipient_type === "bcc")
        .map((r: any) => r.email);

      const payload: any = {
        from: `${merchant.business_name} <noreply@pawbucks.app>`,
        to: toRecipients,
        subject: `Invoice #${invoice.invoice_number} was updated`,
        html,
      };
      if (ccRecipients.length) payload.cc = ccRecipients;
      if (bccRecipients.length) payload.bcc = bccRecipients;

      const resp = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errorText = await resp.text();
        console.error("Resend error:", errorText);
        throw new Error("Failed to send modification email");
      }
    } else {
      console.log("RESEND_API_KEY not configured, skipping email send");
    }

    await supabase.from("invoice_activity").insert({
      invoice_id: invoiceId,
      action: "modified",
      description: `Invoice modified. Changes: ${changesList.join("; ")}`,
      performed_by: userData.user.id,
      metadata: { changes: changesList },
    });

    return new Response(
      JSON.stringify({ success: true, changes: changesList.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("send-invoice-modified-email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});