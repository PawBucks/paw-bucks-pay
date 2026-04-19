import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const formatDateLong = (dateString: string) =>
  new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

async function sendBrandInvoiceEmail(params: {
  invoiceId: string;
  invoiceNumber: string;
  accessToken: string;
  campaignName: string;
  recipientEmail: string;
  recipientName: string;
  total: number;
  dueDate: string;
}) {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    throw new Error("Email service not configured");
  }

  const paymentUrl = `https://pawbucks.app/admin-invoice/${params.invoiceId}/pay?token=${params.accessToken}`;
  const totalFmt = `$${Number(params.total).toFixed(2)}`;
  const dueFmt = formatDateLong(params.dueDate);
  const emailHtml = `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial,sans-serif;background:#f5f7fa;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f7fa;padding:20px;"><tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:10px;overflow:hidden;">
  <tr><td style="padding:24px;text-align:center;border-bottom:1px solid #e5e7eb;">
    <img src="https://pawbucks.app/logo.png" alt="PawBucks" width="120" style="display:block;margin:0 auto;"/>
  </td></tr>
  <tr><td style="padding:30px 30px 10px;text-align:center;">
    <p style="margin:0 0 4px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Brand Campaign Invoice</p>
    <h1 style="margin:0;font-size:22px;color:#111827;font-weight:700;">${params.invoiceNumber}</h1>
    <p style="margin:8px 0 0;font-size:15px;color:#6b7280;">${params.campaignName}</p>
  </td></tr>
  <tr><td style="padding:20px 30px;">
    <p style="margin:0;font-size:14px;color:#374151;line-height:1.6;">Hi ${params.recipientName},</p>
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

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${resendApiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [params.recipientEmail],
      subject: `Invoice ${params.invoiceNumber} from PawBucks — ${params.campaignName}`,
      html: emailHtml,
    }),
  });

  if (!resp.ok) {
    const errText = await resp.text();
    console.error("Brand invoice email send failed:", errText);
    throw new Error("Failed to send invoice email");
  }

  console.log(`Brand invoice ${params.invoiceNumber} emailed to ${params.recipientEmail}`);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const auth = req.headers.get("Authorization");
    if (!auth) return jsonResponse({ error: "Unauthorized" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: auth } } });
    const { data: userData } = await userClient.auth.getUser();
    const user = userData.user;
    if (!user) return jsonResponse({ error: "Unauthorized" }, 401);

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
      return jsonResponse({ error: "Forbidden" }, 403);
    }

    const ba = campaign.brand_accounts as any;
    const recipientEmail = ba.billing_contact_email || ba.contact_email || user.email;
    const recipientName = ba.billing_contact_name || ba.contact_name || ba.brand_name;
    if (!recipientEmail) {
      throw new Error("No billing email found for this brand account");
    }

    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 14);

    let invoice:
      | {
          id: string;
          invoice_number: string;
          access_token: string;
          recipient_email: string | null;
          recipient_name: string;
          due_date: string;
          total: number;
          status: string;
        }
      | null = null;
    let alreadyExists = false;

    if (campaign.admin_invoice_id) {
      alreadyExists = true;
      const { data: existingInvoice, error: existingInvoiceError } = await admin
        .from("admin_invoices")
        .select("id, invoice_number, access_token, recipient_email, recipient_name, due_date, total, status")
        .eq("id", campaign.admin_invoice_id)
        .single();

      if (existingInvoiceError || !existingInvoice) {
        throw existingInvoiceError || new Error("Existing invoice not found");
      }

      invoice = existingInvoice;
    } else {
      const { data: invNumberData } = await admin.rpc("generate_admin_invoice_number");
      const invoiceNumber = invNumberData as string;
      const dueDateString = dueDate.toISOString().slice(0, 10);
      const issueDateString = new Date().toISOString().slice(0, 10);

      const { data: createdInvoice, error: invErr } = await admin
        .from("admin_invoices")
        .insert({
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
          status: "draft",
          due_date: dueDateString,
          issue_date: issueDateString,
        })
        .select("id, invoice_number, access_token, recipient_email, recipient_name, due_date, total, status")
        .single();

      if (invErr || !createdInvoice) throw invErr || new Error("Could not create invoice");

      const { error: itemError } = await admin.from("admin_invoice_items").insert({
        invoice_id: createdInvoice.id,
        description: `${campaign.name} — campaign budget`,
        quantity: 1,
        unit_price: Number(campaign.budget_usd),
      });
      if (itemError) throw itemError;

      const { error: campaignUpdateError } = await admin
        .from("brand_campaigns")
        .update({
          status: "pending_payment",
          funding_method: "invoice",
          admin_invoice_id: createdInvoice.id,
        })
        .eq("id", campaign_id);
      if (campaignUpdateError) throw campaignUpdateError;

      invoice = createdInvoice;

      await admin.from("notifications").insert({
        user_id: user.id,
        title: "📨 Invoice Issued",
        message: `Invoice ${invoiceNumber} for $${Number(campaign.budget_usd).toLocaleString()} was sent to ${recipientEmail}. Your campaign activates upon payment.`,
        category: "transactional",
        link_url: `/admin-invoice-payment/${createdInvoice.id}?token=${createdInvoice.access_token}`,
      });
    }

    const emailTarget = invoice.recipient_email || recipientEmail;
    await sendBrandInvoiceEmail({
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoice_number,
      accessToken: invoice.access_token,
      campaignName: campaign.name,
      recipientEmail: emailTarget,
      recipientName: invoice.recipient_name || recipientName,
      total: Number(invoice.total ?? campaign.budget_usd),
      dueDate: invoice.due_date,
    });

    if (invoice.status === "draft") {
      const { error: statusError } = await admin
        .from("admin_invoices")
        .update({ status: "sent" })
        .eq("id", invoice.id);
      if (statusError) throw statusError;
      invoice.status = "sent";
    }

    return jsonResponse({
      ok: true,
      already: alreadyExists,
      resent: alreadyExists,
      invoice_id: invoice.id,
      invoice_number: invoice.invoice_number,
      access_token: invoice.access_token,
      payment_url: `/admin-invoice-payment/${invoice.id}?token=${invoice.access_token}`,
    });
  } catch (e) {
    console.error("request-brand-campaign-invoice error:", e);
    return jsonResponse({ error: (e as Error).message }, 500);
  }
});
