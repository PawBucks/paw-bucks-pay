import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, json, HttpError, resolveTerminalMerchant } from "../_shared/terminal-merchant.ts";

// Totals always come from the saved POS sale (computed by complete_pos_sale), never from the phone.
const Body = z.object({ posSaleId: z.string().uuid() });
const SUCCESS_FEE = 0.03; // 3% Success Fee on card (USD) amounts

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "posSaleId is required" }, 400);
    const { posSaleId } = parsed.data;

    const { admin } = await resolveTerminalMerchant(req).catch((e) => { throw e; });
    const { data: sale } = await admin.from("merchant_pos_sales")
      .select("id, merchant_id, total, tip, status, stripe_payment_intent_id").eq("id", posSaleId).maybeSingle();
    if (!sale) throw new HttpError(404, "Sale not found");

    const { stripe, merchant, stripeAccount } = await resolveTerminalMerchant(req, sale.merchant_id);
    if (sale.status !== "awaiting_payment") throw new HttpError(409, "This sale is not waiting for payment");

    const amount = Math.round(Number(sale.total) * 100);
    if (amount < 50) throw new HttpError(400, "Minimum card charge is $0.50");
    const opts = { stripeAccount };

    // Reuse an open intent for this sale so retries never double-charge.
    if (sale.stripe_payment_intent_id) {
      const pi = await stripe.paymentIntents.retrieve(sale.stripe_payment_intent_id, opts).catch(() => null);
      if (pi && pi.amount === amount && ["requires_payment_method", "requires_confirmation"].includes(pi.status)) {
        return json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, amount });
      }
    }

    const { data: items } = await admin.from("merchant_pos_sale_items")
      .select("name, quantity, unit_price").eq("sale_id", sale.id);
    const tipCents = Math.round(Number(sale.tip ?? 0) * 100);

    const pi = await stripe.paymentIntents.create({
      amount,
      currency: "usd",
      payment_method_types: ["card_present"],
      capture_method: "automatic",
      application_fee_amount: Math.round(amount * SUCCESS_FEE),
      description: `${merchant.business_name ?? "PawBucks"} POS sale`,
      metadata: {
        source: "pos_terminal",
        pos_sale_id: sale.id,
        merchant_id: merchant.id,
        tip_cents: String(tipCents),
        items: JSON.stringify((items ?? []).map((i) => ({ n: i.name, q: i.quantity, p: i.unit_price }))).slice(0, 500),
      },
    }, { ...opts, idempotencyKey: `pos-terminal-${sale.id}-${amount}` });

    await admin.from("merchant_pos_sales").update({ stripe_payment_intent_id: pi.id }).eq("id", sale.id);
    return json({ clientSecret: pi.client_secret, paymentIntentId: pi.id, amount });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error("[TERMINAL-PI]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, status);
  }
});
