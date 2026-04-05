import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2024-12-18.acacia",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { invoiceId, token } = await req.json();

    if (!invoiceId || !token) {
      throw new Error("Invoice ID and access token are required");
    }

    // Fetch the invoice and validate token
    const { data: invoice, error: invoiceError } = await supabase
      .from("admin_invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("access_token", token)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found or invalid token");
    }

    if (invoice.status === "paid") {
      throw new Error("This invoice has already been paid");
    }

    if (invoice.status === "void" || invoice.status === "cancelled") {
      throw new Error("This invoice is no longer active");
    }

    const amountDue = Number(invoice.amount_due ?? invoice.total) - Number(invoice.amount_paid || 0);
    if (amountDue <= 0) {
      throw new Error("No balance due on this invoice");
    }

    const amountInCents = Math.round(amountDue * 100);
    const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "https://pawbucks.app";

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: invoice.currency || "usd",
            product_data: {
              name: `Invoice ${invoice.invoice_number}`,
              description: invoice.title || `PawBucks Platform Invoice`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${appUrl}/admin-invoice/${invoiceId}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${appUrl}/admin-invoice/${invoiceId}/pay?token=${token}`,
      customer_email: invoice.recipient_email || undefined,
      metadata: {
        admin_invoice_id: invoiceId,
        type: "admin_invoice_payment",
        invoice_number: invoice.invoice_number,
      },
      billing_address_collection: "auto",
    });

    // Record payment as pending
    await supabase.from("admin_invoice_payments").insert({
      invoice_id: invoiceId,
      amount: amountDue,
      payment_method: "stripe",
      stripe_payment_id: session.id,
      notes: "Online payment via Stripe Checkout",
      recorded_by: "system",
    });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 }
    );
  } catch (error: any) {
    console.error("Error creating admin invoice payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
