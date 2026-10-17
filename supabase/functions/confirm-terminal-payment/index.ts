import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, json, HttpError, resolveTerminalMerchant } from "../_shared/terminal-merchant.ts";
import { sendPosReceipts } from "../_shared/pos-receipts.ts";

// Called by the mobile app after Tap to Pay succeeds. Verifies the charge with Stripe, then marks the sale paid.
const Body = z.object({ posSaleId: z.string().uuid(), email: z.string().trim().email().max(255).optional() });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "posSaleId is required" }, 400);

    const { admin } = await resolveTerminalMerchant(req);
    const { data: sale } = await admin.from("merchant_pos_sales")
      .select("id, merchant_id, status, stripe_payment_intent_id").eq("id", parsed.data.posSaleId).maybeSingle();
    if (!sale) throw new HttpError(404, "Sale not found");
    const { stripe, stripeAccount } = await resolveTerminalMerchant(req, sale.merchant_id);

    if (sale.status === "completed") {
      const receipts = await sendPosReceipts(admin, sale.id, { email: parsed.data.email });
      return json({ status: "completed", receipts });
    }
    if (!sale.stripe_payment_intent_id) throw new HttpError(409, "No card payment started for this sale");

    const pi = await stripe.paymentIntents.retrieve(sale.stripe_payment_intent_id, { stripeAccount });
    if (pi.metadata?.pos_sale_id !== sale.id) throw new HttpError(409, "Payment does not match this sale");
    if (pi.status !== "succeeded") return json({ status: "awaiting_payment", stripeStatus: pi.status });

    const { error: updateError } = await admin.from("merchant_pos_sales")
      .update({ status: "completed", paid_at: new Date().toISOString() })
      .eq("id", sale.id).eq("status", "awaiting_payment");
    if (updateError) throw new HttpError(500, "Payment received, but the sale could not be updated");
    try {
      const receipts = await sendPosReceipts(admin, sale.id, { email: parsed.data.email || pi.receipt_email || undefined });
      return json({ status: "completed", receipts });
    } catch (error) {
      console.error("[TERMINAL-RECEIPTS]", error);
      return json({ status: "completed", receipts: { success: false }, warning: "Payment received, but receipt emails could not be sent" });
    }
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error("[TERMINAL-CONFIRM]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, status);
  }
});
