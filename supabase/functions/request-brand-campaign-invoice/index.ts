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
      amount_due: Number(campaign.budget_usd),
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
