import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

    const { invoiceId, amount, tipAmount, userId } = await req.json();

    if (!invoiceId || !amount) {
      throw new Error("Invoice ID and amount are required");
    }

    // Fetch the invoice
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found");
    }

    // Fetch the merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", invoice.merchant_id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    const appUrl = Deno.env.get("APP_URL") || req.headers.get("origin") || "https://paw-bucks-pay.lovable.app";

    // Create line items for Stripe Checkout
    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [
      {
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: `Invoice #${invoice.invoice_number}`,
            description: invoice.title || `Payment for invoice from ${merchant.business_name}`,
          },
          unit_amount: amount,
        },
        quantity: 1,
      },
    ];

    // Add tip as separate line item if provided
    if (tipAmount && tipAmount > 0) {
      lineItems.push({
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: "Tip",
            description: "Optional gratuity",
          },
          unit_amount: tipAmount,
        },
        quantity: 1,
      });
    }

    // Validate Stripe Connect account if merchant has one
    const connectedAccountId = merchant.stripe_account_id;
    let isConnectValid = false;
    
    if (connectedAccountId && merchant.stripe_account_status === "active") {
      try {
        // Verify the account exists and is usable
        const account = await stripe.accounts.retrieve(connectedAccountId);
        isConnectValid = account && (account.charges_enabled || account.payouts_enabled);
        console.log(`Stripe Connect account validation: ${connectedAccountId} - valid: ${isConnectValid}`);
      } catch (accountError: any) {
        console.error(`Stripe Connect account ${connectedAccountId} not found or invalid:`, accountError.message);
        isConnectValid = false;
        
        // Update merchant status in database to reflect invalid account
        await supabase
          .from("merchants")
          .update({ 
            stripe_account_status: "needs_reconnect",
            updated_at: new Date().toISOString()
          })
          .eq("id", merchant.id);
      }
    }

    let session: Stripe.Checkout.Session;

    // Metadata to include in checkout - always include user_id for PawBucks rewards
    const metadata = {
      invoice_id: invoiceId,
      merchant_id: merchant.id,
      type: "invoice_payment",
      tip_amount: String(tipAmount || 0),
      pawbucks_used: "0", // This function doesn't handle PawBucks, but included for consistency
      user_id: userId || "", // CRITICAL: Required for PawBucks rewards and transaction records
    };

    if (isConnectValid && connectedAccountId) {
      // Use Stripe Connect destination charges (Express accounts)
      const applicationFee = Math.round((amount + (tipAmount || 0)) * 0.03); // 3% platform fee

      console.log(`Creating Connect checkout for merchant ${merchant.id} with destination ${connectedAccountId}`);

      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: lineItems,
        mode: "payment",
        success_url: `${appUrl}/invoice/${invoiceId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/invoice/${invoiceId}/pay?token=${invoice.access_token}`,
        customer_email: invoice.client_email,
        metadata,
        payment_intent_data: {
          application_fee_amount: applicationFee,
          transfer_data: {
            destination: connectedAccountId,
          },
          metadata: {
            type: "invoice_payment",
            invoice_id: invoiceId,
            merchant_id: merchant.id,
            user_id: userId || "",
            tip_amount: String(tipAmount || 0),
            pawbucks_used: "0",
          },
        },
        billing_address_collection: "auto",
      });
    } else {
      // Standard checkout without Connect - add merchant info to product description
      console.log(`Creating standard checkout for merchant ${merchant.id} (no valid Connect account)`);
      
      const brandedLineItems = lineItems.map(item => ({
        ...item,
        price_data: {
          ...item.price_data,
          product_data: {
            ...item.price_data?.product_data,
            name: item.price_data?.product_data?.name === "Tip" 
              ? `Tip for ${merchant.business_name}`
              : `${item.price_data?.product_data?.name} - ${merchant.business_name}`,
            description: item.price_data?.product_data?.description || `Payment to ${merchant.business_name}`,
          },
        },
      }));

      session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        line_items: brandedLineItems as Stripe.Checkout.SessionCreateParams.LineItem[],
        mode: "payment",
        success_url: `${appUrl}/invoice/${invoiceId}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${appUrl}/invoice/${invoiceId}/pay?token=${invoice.access_token}`,
        customer_email: invoice.client_email,
        metadata,
        billing_address_collection: "auto",
      });
    }

    // Log activity
    await supabase
      .from("invoice_activity")
      .insert({
        invoice_id: invoiceId,
        action: "payment_initiated",
        description: `Payment of $${(amount / 100).toFixed(2)} initiated`,
        metadata: {
          checkout_session_id: session.id,
          amount: amount,
          tip_amount: tipAmount || 0,
          user_id: userId || null,
        },
      });

    return new Response(
      JSON.stringify({ url: session.url, sessionId: session.id }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error("Error creating invoice payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 400,
      }
    );
  }
});
