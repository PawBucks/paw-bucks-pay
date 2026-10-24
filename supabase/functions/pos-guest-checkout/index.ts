import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";
import { corsHeaders, json, HttpError } from "../_shared/terminal-merchant.ts";
import { safeOrigin } from "../_shared/safe-origin.ts";
import { sendPosReceipts } from "../_shared/pos-receipts.ts";

// Guest (signed-out) card checkout for a POS sale ticket. No PawBucks are earned.
// Totals always come from the saved sale; the sale id is the only client input.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), posSaleId: z.string().uuid() }),
  z.object({ action: z.literal("verify"), posSaleId: z.string().uuid(), sessionId: z.string().startsWith("cs_").max(255) }),
]);
const SUCCESS_FEE = 0.03;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const parsed = Body.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) return json({ error: "Invalid request" }, 400);
    const body = parsed.data;
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new HttpError(500, "Payments are not configured");
    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });
    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: sale } = await admin.from("merchant_pos_sales")
      .select("id, merchant_id, total, tip, tax, status").eq("id", body.posSaleId).maybeSingle();
    if (!sale) throw new HttpError(404, "Sale not found");
    const { data: merchant } = await admin.from("merchants")
      .select("id, business_name, stripe_account_id, onboarding_complete").eq("id", sale.merchant_id).maybeSingle();
    if (!merchant?.stripe_account_id || !merchant.onboarding_complete) throw new HttpError(400, "This business can't take card payments yet");
    const stripeAccount = merchant.stripe_account_id as string;

    if (body.action === "verify") {
      const session = await stripe.checkout.sessions.retrieve(body.sessionId, { stripeAccount });
      if (session.metadata?.pos_sale_id !== sale.id) throw new HttpError(409, "Payment does not match this sale");
      if (session.payment_status !== "paid") return json({ status: "awaiting_payment" });
      if (sale.status === "awaiting_payment") {
        const piId = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
        await admin.from("merchant_pos_sales")
          .update({ status: "completed", paid_at: new Date().toISOString(), stripe_payment_intent_id: piId ?? null })
          .eq("id", sale.id).eq("status", "awaiting_payment");
        try {
          await sendPosReceipts(admin, sale.id, { email: session.customer_details?.email || undefined });
        } catch (e) { console.error("[POS-GUEST-RECEIPTS]", e); }
      }
      return json({ status: "completed", total: Number(sale.total) });
    }

    if (sale.status !== "awaiting_payment") throw new HttpError(409, "This sale is not waiting for payment");
    const amount = Math.round(Number(sale.total) * 100);
    if (amount < 50) throw new HttpError(400, "Minimum card charge is $0.50");
    const tipCents = Math.round(Number(sale.tip ?? 0) * 100);
    const taxCents = Math.round(Number(sale.tax ?? 0) * 100);
    // Success Fee never applies to tax or tips; tax is remitted to PawBucks via the application fee.
    const successFeeCents = Math.round(Math.max(0, amount - tipCents - taxCents) * SUCCESS_FEE);
    const applicationFee = Math.min(amount, successFeeCents + taxCents);
    const { data: items } = await admin.from("merchant_pos_sale_items").select("name, quantity").eq("sale_id", sale.id);
    const summary = (items ?? []).map((i) => `${i.quantity}x ${i.name}`).join(", ").slice(0, 400);
    const origin = safeOrigin(req);
    const back = `${origin}/pay/${merchant.id}?pos_sale=${sale.id}`;
    const metadata = { source: "pos_guest_checkout", pos_sale_id: sale.id, merchant_id: merchant.id };

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      line_items: [{
        quantity: 1,
        price_data: { currency: "usd", unit_amount: amount, product_data: { name: `${merchant.business_name ?? "PawBucks"} purchase`, description: summary || undefined } },
      }],
      success_url: `${back}&guest_session={CHECKOUT_SESSION_ID}`,
      cancel_url: back,
      metadata,
      payment_intent_data: {
        application_fee_amount: applicationFee,
        metadata: { ...metadata, tip_cents: String(tipCents), tax_remitted_cents: String(taxCents), success_fee_cents: String(successFeeCents) },
      },
      billing_address_collection: "auto",
    }, { stripeAccount, idempotencyKey: `pos-guest-${sale.id}-${amount}-${Math.floor(Date.now() / 600000)}` });
    return json({ url: session.url });
  } catch (e) {
    const status = e instanceof HttpError ? e.status : 500;
    console.error("[POS-GUEST]", e);
    return json({ error: e instanceof Error ? e.message : "Unexpected error" }, status);
  }
});
