import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { posReceiptItems } from "./pos-receipt-data.ts";

/** Saved sale data is authoritative; recipients are delivered independently. */
export async function sendPosReceipts(admin: SupabaseClient, saleId: string, options: { email?: string; merchantOnly?: boolean } = {}) {
  const { data: sale, error } = await admin.from("merchant_pos_sales")
    .select("id,merchant_id,discount,tax,tip,total,payment_method,customer_name,status,created_at,paid_at,transaction_id")
    .eq("id", saleId).maybeSingle();
  if (error || !sale) throw new Error("Sale not found");
  if (sale.status !== "completed") throw new Error("Receipts can only be sent for completed sales");
  const { data: merchant, error: merchantError } = await admin.from("merchants")
    .select("user_id,business_name,address,phone,email").eq("id", sale.merchant_id).single();
  if (merchantError || !merchant) throw new Error("Business not found");
  const { data: owner } = await admin.from("profiles").select("email").eq("id", merchant.user_id).maybeSingle();
  const { data: lines, error: linesError } = await admin.from("merchant_pos_sale_items")
    .select("name,unit_price,quantity,line_total").eq("sale_id", saleId);
  if (linesError || !lines?.length) throw new Error("Receipt items could not be loaded");
  let customerEmail = options.email;
  let pawbucksApplied = 0;
  let cardAmount = Number(sale.total);
  if (sale.transaction_id) {
    const { data: transaction } = await admin.from("transactions").select("user_id,pawbucks_used,stripe_amount").eq("id", sale.transaction_id).maybeSingle();
    if (transaction) {
      pawbucksApplied = Number(transaction.pawbucks_used || 0);
      cardAmount = Number(transaction.stripe_amount || 0);
      if (!customerEmail && transaction.user_id) {
        const { data: customer } = await admin.from("profiles").select("email").eq("id", transaction.user_id).maybeSingle();
        customerEmail = customer?.email || undefined;
      }
    }
  }
  const base = {
    customerName: sale.customer_name || undefined,
    transactionDate: sale.paid_at || sale.created_at,
    receiptId: sale.id,
    merchantName: merchant.business_name || "Merchant",
    merchantLocation: merchant.address || undefined,
    merchantPhone: merchant.phone || undefined,
    merchantEmail: merchant.email || undefined,
    items: posReceiptItems(lines, sale),
    subtotal: Number(sale.total), pawbucksApplied, cardAmount, totalPaid: Number(sale.total),
    paymentLabel: sale.payment_method === "cash" ? "Cash paid" : sale.payment_method === "other" ? "Payment recorded" : "Card charged",
  };
  const deliver = async (email: string | undefined, audience: "merchant" | "customer") => {
    if (!email) return { status: "missing_email" };
    try {
      const response = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-receipt-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`, "x-internal-secret": Deno.env.get("INTERNAL_TRIGGER_SECRET") ?? "" },
        body: JSON.stringify({ ...base, email, audience, idempotencyKey: `pos-receipt-${sale.id}-${audience}-${email.toLowerCase()}` }),
      });
      const result = await response.json();
      if (!response.ok || result.success !== true) throw new Error("Email delivery failed");
      return { status: "sent" };
    } catch (error) {
      console.error("[POS-RECEIPT] Delivery failed", { saleId, audience, error: String(error) });
      return { status: "failed" };
    }
  };
  const [merchantResult, customerResult] = await Promise.all([
    deliver(merchant.email || owner?.email || undefined, "merchant"),
    options.merchantOnly ? Promise.resolve({ status: "handled_by_checkout" }) : deliver(customerEmail, "customer"),
  ]);
  return { success: merchantResult.status === "sent" && !["failed"].includes(customerResult.status), merchant: merchantResult, customer: customerResult };
}