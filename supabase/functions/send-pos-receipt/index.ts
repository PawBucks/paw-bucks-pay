import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.23.8";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

const Body = z.object({
  saleId: z.string().uuid(),
  email: z.string().trim().email().max(255),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") || "").replace("Bearer ", "");
    const { data: u } = await admin.auth.getUser(token);
    if (!u?.user) return json({ error: "Not signed in" }, 401);

    const parsed = Body.safeParse(await req.json());
    if (!parsed.success) return json({ error: "Enter a valid email address" }, 400);
    const { saleId, email } = parsed.data;

    const { data: sale } = await admin.from("merchant_pos_sales")
      .select("id, merchant_id, subtotal, discount, tax, tip, total, payment_method, customer_name, status, created_at")
      .eq("id", saleId).maybeSingle();
    if (!sale) return json({ error: "Sale not found" }, 404);
    if (sale.payment_method === "pawbucks_card") return json({ error: "Card via PawBucks sales get their receipt automatically" }, 400);

    const { data: merchant } = await admin.from("merchants")
      .select("id, user_id, business_name, address, phone, email").eq("id", sale.merchant_id).maybeSingle();
    if (!merchant || merchant.user_id !== u.user.id) return json({ error: "Not allowed" }, 403);

    const { data: lines } = await admin.from("merchant_pos_sale_items")
      .select("name, unit_price, quantity, line_total").eq("sale_id", saleId);

    const items: { name: string; price: number; qty?: number; unit_price?: number }[] =
      (lines || []).map((l: any) => ({ name: l.name, price: Number(l.line_total), qty: l.quantity, unit_price: Number(l.unit_price) }));
    if (Number(sale.discount) > 0) items.push({ name: "Discount", price: -Number(sale.discount) });
    if (Number(sale.tax) > 0) items.push({ name: "Sales tax", price: Number(sale.tax) });
    if (Number(sale.tip) > 0) items.push({ name: "Tip", price: Number(sale.tip) });

    const total = Number(sale.total);
    const res = await fetch(`${url}/functions/v1/send-receipt-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        "x-internal-secret": Deno.env.get("INTERNAL_TRIGGER_SECRET") ?? "",
      },
      body: JSON.stringify({
        email,
        customerName: sale.customer_name || undefined,
        transactionDate: sale.created_at,
        receiptId: sale.id.slice(0, 8).toUpperCase(),
        merchantName: merchant.business_name || "Merchant",
        merchantLocation: merchant.address || undefined,
        merchantPhone: merchant.phone || undefined,
        merchantEmail: merchant.email || undefined,
        items,
        subtotal: total,
        pawbucksApplied: 0,
        cardAmount: total,
        totalPaid: total,
      }),
    });
    if (!res.ok) {
      console.error("send-pos-receipt: receipt email failed", res.status, await res.text());
      return json({ error: "Receipt email couldn't be sent" }, 502);
    }
    return json({ success: true });
  } catch (e) {
    console.error("send-pos-receipt error", e);
    return json({ error: "Receipt email couldn't be sent" }, 500);
  }
});
