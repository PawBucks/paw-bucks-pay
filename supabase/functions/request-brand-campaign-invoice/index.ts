import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { campaign_id } = await req.json();
    if (!campaign_id) throw new Error("campaign_id required");

    const admin = createClient(supabaseUrl, serviceKey);

    const { data: campaign } = await admin
      .from("brand_campaigns")
      .select("*, brand_accounts!inner(id, user_id, brand_name, contact_email, contact_name, billing_contact_email, billing_contact_name)")
      .eq("id", campaign_id)
      .single();

    if (!campaign) throw new Error("Campaign not found");
    if ((campaign.brand_accounts as any).user_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    if (campaign.admin_invoice_id) {
      return new Response(JSON.stringify({ ok: true, already: true, invoice_id: campaign.admin_invoice_id }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Generate invoice number
    const { data: invNumberData } = await admin.rpc("generate_admin_invoice_number");
    const invoiceNumber = invNumberData as string;

    const ba = campaign.brand_accounts as any;
    const recipientEmail = ba.billing_contact_email || ba.contact_email || user.email;
    const recipientName = ba.billing_contact_name || ba.contact_name || ba.brand_name;
    const dueDate = new Date(); dueDate.setDate(dueDate.getDate() + 14);

    const { data: invoice, error: invErr } = await admin.from("admin_invoices").insert({
      created_by: user.id,
      invoice_number: invoiceNumber,
      recipient_id: ba.id,
      recipient_type: "brand",
      recipient_email: recipientEmail,
      recipient_name: recipientName,
      title: `Brand Campaign Funding: ${campaign.name}`,
      description: `Pre-funded budget for branded PawBucks campaign "${campaign.name}". Campaign activates upon payment.`,
      invoice_type: "brand_campaign",
      currency: "usd",
      subtotal: Number(campaign.budget_usd),
      total: Number(campaign.budget_usd),
      amount_paid: 0,
      status: "sent",
      due_date: dueDate.toISOString().slice(0, 10),
      issue_date: new Date().toISOString().slice(0, 10),
    }).select().single();

    if (invErr || !invoice) throw invErr || new Error("Could not create invoice");

    await admin.from("admin_invoice_items").insert({
      invoice_id: invoice.id,
      description: `${campaign.name} — campaign budget`,
      quantity: 1,
      unit_price: Number(campaign.budget_usd),
    });

    await admin.from("brand_campaigns").update({
      status: "pending_payment",
      funding_method: "invoice",
      admin_invoice_id: invoice.id,
    }).eq("id", campaign_id);

    // Send invoice email via Resend
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    const paymentUrl = `https://pawbucks.app/admin-invoice/${invoice.id}/pay?token=${invoice.access_token}`;
    const totalFmt = `$${Number(campaign.budget_usd).toFixed(2)}`;
    const dueFmt = new Date(dueDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    if (RESEND_API_KEY) {
      const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7fa;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;">
  <tr><td style="padding:24px;text-align:center;border-bottom:1px solid #e5e7eb;">
    <img src="https://pawbucks.app/logo.png" alt="PawBucks" width="120" style="display:block;margin:0 auto;"/>
  </td></tr>
  <tr><td style="padding:30px 30px 10px;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Brand Campaign Invoice</p>
    <h1 style="margin:0;font-size:22px;color:#111827;font-weight:700;">${invoiceNumber}</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#6b7280;">${campaign.name}</p>
  </td></tr>
  <tr><td style="padding:20px 30px;">
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">Hi ${recipientName},</p>
    <p style="margin:12px 0 0;font-size:14px;color:#374151;line-height:1.6;">Thank you for funding your branded PawBucks campaign. Please find your invoice details below. Your campaign will activate automatically upon payment.</p>
  </td></tr>
  <tr><td style="padding:0 30px 20px;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;border-radius:8px;">
      <tr><td style="padding:14px 16px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;">Amount Due</p>
        <p style="margin:4px 0 0;font-weight:700;font-size:24px;color:#2a9d8f;">${totalFmt}</p>
      </td><td align="right" style="padding:14px 16px;">
        <p style="margin:0;font-size:11px;color:#9ca3af;text-transform:uppercase;">Due Date</p>
        <p style="margin:4px 0 0;font-weight:600;font-size:14px;color:#111827;">${dueFmt}</p>
      </td></tr>
    </table>
  </td></tr>
  <tr><td style="padding:0 30px 30px;text-align:center;">
    <a href="${paymentUrl}" style="display:inline-block;padding:14px 48px;background:#2a9d8f;color:#fff;font-size:16px;font-weight:700;text-decoration:none;border-radius:8px;">Pay Invoice</a>
    <p style="margin:10px 0 0;font-size:12px;color:#9ca3af;">Click above to pay securely online</p>
  </td></tr>
  <tr><td style="background:#f9fafb;padding:20px;text-align:center;border-top:1px solid #e5e7eb;">
    <p style="margin:0;color:#9ca3af;font-size:12px;">Questions? Contact the PawBucks team.</p>
    <p style="margin:10px 0 0;color:#9ca3af;font-size:11px;">Powered by PawBucks</p>
  </td></tr>
</table></td></tr></table></body></html>`;

      try {
        const resp = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            from: "PawBucks <noreply@pawbucks.app>",
            to: [recipientEmail],
            subject: `Invoice ${invoiceNumber} from PawBucks — ${campaign.name}`,
            html: emailHtml,
          }),
        });
        if (!resp.ok) {
          const errText = await resp.text();
          console.error("Resend send failed:", errText);
        } else {
          console.log(`Brand invoice ${invoiceNumber} emailed to ${recipientEmail}`);
        }
      } catch (e) {
        console.error("Email send exception:", e);
      }
    } else {
      console.warn("RESEND_API_KEY not configured — skipping invoice email");
    }

    // Notify brand owner
    await admin.from("notifications").insert({
      user_id: user.id,
      title: "📨 Invoice Issued",
      message: `Invoice ${invoiceNumber} for $${Number(campaign.budget_usd).toLocaleString()} was sent to ${recipientEmail}. Your campaign activates upon payment.`,
      category: "transactional",
      link_url: `/admin-invoice-payment/${invoice.id}?token=${invoice.access_token}`,
    });

    return new Response(JSON.stringify({
      ok: true,
      invoice_id: invoice.id,
      invoice_number: invoiceNumber,
      access_token: invoice.access_token,
      payment_url: `/admin-invoice-payment/${invoice.id}?token=${invoice.access_token}`,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("request-brand-campaign-invoice error:", e);
    return new Response(JSON.stringify({ error: (e as Error).message }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
