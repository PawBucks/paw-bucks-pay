import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAWBUCKS_TO_USD = 0.001; // 1 PawBuck = $0.001
const PLATFORM_FEE_PERCENT = 0.03; // 3% platform fee

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PROCESS-INVOICE-PAWBUCKS-PAYMENT] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") || "", {
      apiVersion: "2025-08-27.basil",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { 
      invoiceId, 
      totalAmountCents, 
      pawbucksAmountCents, 
      tipAmountCents,
      userId,
      accessToken,
      isGuestCheckout,
    } = await req.json();

    if (!invoiceId || totalAmountCents === undefined) {
      throw new Error("Invoice ID and total amount are required");
    }
    
    // Validate: Guest checkout cannot use PawBucks
    if (isGuestCheckout && pawbucksAmountCents > 0) {
      throw new Error("Guest checkout cannot use PawBucks. Please sign in to use PawBucks.");
    }

    logStep("Request validated", { invoiceId, totalAmountCents, pawbucksAmountCents });

    // Fetch the invoice with access token validation
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*")
      .eq("id", invoiceId)
      .eq("access_token", accessToken)
      .single();

    if (invoiceError || !invoice) {
      throw new Error("Invoice not found or invalid access token");
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

    logStep("Invoice and merchant found", { merchantId: merchant.id, businessName: merchant.business_name });

    // Check if PawBucks are allowed
    const acceptsPawbucks = invoice.accept_pawbucks || merchant.accepts_pawbucks;
    if (!acceptsPawbucks && pawbucksAmountCents > 0) {
      throw new Error("This invoice does not accept PawBucks payments");
    }

    const appUrl = Deno.env.get("APP_URL") || "https://pawbucks.app";
    const stripeAmountCents = totalAmountCents - pawbucksAmountCents;
    const pawbucksUsed = Math.round(pawbucksAmountCents / PAWBUCKS_TO_USD / 100);

    // Validate Stripe Connect account if merchant has one
    const connectedAccountId = merchant.stripe_account_id;
    let isConnectValid = false;
    
    if (connectedAccountId && merchant.stripe_account_status === "active" && merchant.onboarding_complete) {
      try {
        const account = await stripe.accounts.retrieve(connectedAccountId);
        isConnectValid = account && (account.charges_enabled || account.payouts_enabled);
        logStep(`Stripe Connect account validation: ${connectedAccountId} - valid: ${isConnectValid}`);
      } catch (accountError: any) {
        console.error(`Stripe Connect account ${connectedAccountId} not found or invalid:`, accountError.message);
        isConnectValid = false;
        
        await supabase
          .from("merchants")
          .update({ 
            stripe_account_status: "needs_reconnect",
            updated_at: new Date().toISOString()
          })
          .eq("id", merchant.id);
      }
    }

    // If paying entirely with PawBucks
    if (stripeAmountCents <= 0 && pawbucksAmountCents > 0) {
      logStep("Processing full PawBucks payment");
      
      if (!userId) {
        throw new Error("User ID is required for PawBucks payments");
      }

      const { data: wallet, error: walletError } = await supabase
        .from("pawbucks_wallet")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (walletError || !wallet) {
        throw new Error("PawBucks wallet not found");
      }

      if (wallet.balance < pawbucksUsed) {
        throw new Error(`Insufficient PawBucks balance. You have ${wallet.balance} but need ${pawbucksUsed}`);
      }

      // Deduct PawBucks from user's wallet
      const { error: deductError } = await supabase
        .from("pawbucks_wallet")
        .update({ 
          balance: wallet.balance - pawbucksUsed,
          updated_at: new Date().toISOString()
        })
        .eq("user_id", userId);

      if (deductError) {
        throw new Error("Failed to deduct PawBucks");
      }

      // Log user PawBucks activity
      await supabase.from("pawbucks_activity").insert({
        user_id: userId,
        type: "redeem",
        amount: -pawbucksUsed,
        description: `Payment for Invoice #${invoice.invoice_number}`,
        merchant_id: merchant.id,
      });

      // Credit merchant's PawBucks wallet
      const { data: merchantWallet } = await supabase
        .from("merchant_pawbucks_wallet")
        .select("*")
        .eq("merchant_id", merchant.id)
        .single();

      if (merchantWallet) {
        await supabase
          .from("merchant_pawbucks_wallet")
          .update({ 
            balance: merchantWallet.balance + pawbucksUsed,
            total_earned: (merchantWallet.total_earned || 0) + pawbucksUsed,
            updated_at: new Date().toISOString()
          })
          .eq("merchant_id", merchant.id);
      } else {
        await supabase.from("merchant_pawbucks_wallet").insert({
          merchant_id: merchant.id,
          balance: pawbucksUsed,
          total_earned: pawbucksUsed,
        });
      }

      // Log merchant PawBucks activity
      await supabase.from("merchant_pawbucks_activity").insert({
        merchant_id: merchant.id,
        type: "earn",
        amount: pawbucksUsed,
        description: `Invoice #${invoice.invoice_number} payment received`,
        user_id: userId,
      });

      // Record payment
      const paymentAmountUSD = (pawbucksAmountCents + (tipAmountCents || 0)) / 100;
      const { data: payment, error: paymentError } = await supabase
        .from("invoice_payments")
        .insert({
          invoice_id: invoiceId,
          amount: paymentAmountUSD,
          payment_method: "pawbucks",
          payment_date: new Date().toISOString(),
          status: "completed",
          notes: `Paid with ${pawbucksUsed} PawBucks${tipAmountCents > 0 ? ` (includes $${(tipAmountCents / 100).toFixed(2)} tip)` : ''}`,
        })
        .select()
        .single();

      if (paymentError) {
        console.error("Error recording payment:", paymentError);
      }

      // Update invoice status
      const newAmountPaid = (invoice.amount_paid || 0) + paymentAmountUSD;
      const newAmountDue = invoice.total - newAmountPaid;
      const newStatus = newAmountDue <= 0 ? "paid" : invoice.status;

      await supabase
        .from("invoices")
        .update({
          amount_paid: newAmountPaid,
          amount_due: newAmountDue,
          status: newStatus,
          paid_at: newStatus === "paid" ? new Date().toISOString() : invoice.paid_at,
          updated_at: new Date().toISOString(),
        })
        .eq("id", invoiceId);

      // Log activity
      await supabase.from("invoice_activity").insert({
        invoice_id: invoiceId,
        action: "payment_completed",
        description: `Payment of $${paymentAmountUSD.toFixed(2)} completed using ${pawbucksUsed} PawBucks`,
        metadata: {
          pawbucks_used: pawbucksUsed,
          payment_id: payment?.id,
        },
      });

      // Create transaction record - NO platform fee on PawBucks-only payments
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          merchant_id: merchant.id,
          amount: paymentAmountUSD,
          stripe_amount: 0,
          pawbucks_used: pawbucksUsed,
          application_fee: 0, // No platform fee on PawBucks payments
          cashback_earned: 0,
          rewards_earned: 0,
          description: `Invoice #${invoice.invoice_number}${tipAmountCents > 0 ? ` (includes $${(tipAmountCents / 100).toFixed(2)} tip)` : ''}`,
          status: 'completed',
          stripe_payment_intent_id: `pawbucks_invoice_${invoiceId}`,
        })
        .select()
        .single();

      if (transactionError) {
        console.error("Error creating transaction:", transactionError);
      } else {
        logStep("Transaction recorded", { transactionId: transaction.id });
      }

      // Send receipt and notification emails
      try {
        const { data: profile } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", userId)
          .single();

        await supabase.functions.invoke("send-receipt-email", {
          body: {
            userEmail: profile?.email || invoice.client_email,
            userName: profile?.full_name || invoice.client_name,
            merchantName: merchant.business_name,
            merchantAddress: merchant.address,
            transactionId: payment?.id || invoiceId,
            amount: paymentAmountUSD,
            pawbucksEarned: 0,
            pawbucksUsed: pawbucksUsed,
            description: `Invoice #${invoice.invoice_number}`,
          },
        });
      } catch (emailError) {
        console.error("Error sending receipt email:", emailError);
      }

      // Send merchant notification
      try {
        const { data: merchantProfile } = await supabase
          .from("profiles")
          .select("email, full_name")
          .eq("id", merchant.user_id)
          .single();

        if (merchantProfile?.email) {
          await supabase.functions.invoke("send-invoice-paid-notification", {
            body: {
              merchantEmail: merchantProfile.email,
              merchantName: merchantProfile.full_name || merchant.business_name || "Merchant",
              invoiceNumber: invoice.invoice_number,
              invoiceTitle: invoice.title || undefined,
              clientName: invoice.client_name,
              clientEmail: invoice.client_email,
              amountPaid: 0,
              tipAmount: tipAmountCents > 0 ? tipAmountCents / 100 : 0,
              pawbucksUsed: pawbucksUsed,
              paymentMethod: "pawbucks" as const,
              paymentDate: new Date().toISOString(),
              invoiceTotal: invoice.total,
              amountDue: invoice.total - paymentAmountUSD - (invoice.amount_paid || 0),
              invoiceId: invoiceId,
            },
          });
          logStep("Merchant notification sent", { email: merchantProfile.email });
        }
      } catch (notifError) {
        console.error("Error sending merchant notification:", notifError);
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentMethod: "pawbucks",
          pawbucksUsed,
          amountPaid: paymentAmountUSD,
          pawbucksEarned: 0,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mixed payment or Stripe-only: Need Stripe checkout
    // ============================================================
    // DIRECT CHARGE ARCHITECTURE
    // ============================================================
    // For merchants with valid Connect accounts, we create a PaymentIntent
    // directly on the connected account. This ensures:
    // - Stripe fees are paid by the merchant
    // - Platform only receives 3% application fee
    // - Zero negative balance risk for platform
    // ============================================================

    const lineItems: Stripe.Checkout.SessionCreateParams.LineItem[] = [];

    if (stripeAmountCents > 0) {
      lineItems.push({
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: `Invoice #${invoice.invoice_number}`,
            description: pawbucksAmountCents > 0 
              ? `Payment after ${pawbucksUsed} PawBucks credit applied` 
              : invoice.title || `Payment for invoice from ${merchant.business_name}`,
          },
          unit_amount: stripeAmountCents,
        },
        quantity: 1,
      });
    }

    if (tipAmountCents && tipAmountCents > 0) {
      lineItems.push({
        price_data: {
          currency: invoice.currency || "usd",
          product_data: {
            name: "Tip",
            description: "Optional gratuity",
          },
          unit_amount: tipAmountCents,
        },
        quantity: 1,
      });
    }

    let session: Stripe.Checkout.Session;
    const metadata = {
      invoice_id: invoiceId,
      merchant_id: merchant.id,
      type: "invoice_payment",
      tip_amount: String(tipAmountCents || 0),
      pawbucks_used: String(pawbucksUsed || 0),
      pawbucks_amount_cents: String(pawbucksAmountCents || 0),
      user_id: userId || "",
      is_guest_checkout: String(isGuestCheckout || false),
      charge_type: "direct",
    };

    if (isConnectValid && connectedAccountId) {
      // ============================================================
      // DIRECT CHARGE via Checkout Session on Connected Account
      // ============================================================
      const totalStripeAmount = stripeAmountCents + (tipAmountCents || 0);
      const applicationFee = Math.round(totalStripeAmount * PLATFORM_FEE_PERCENT);

      logStep(`Creating Direct Charge checkout for merchant ${merchant.id}`, { 
        connectedAccountId, 
        totalStripeAmount, 
        applicationFee 
      });
      
      // Create Checkout Session ON the connected account (Direct Charge)
      session = await stripe.checkout.sessions.create(
        {
          payment_method_types: ["card"],
          line_items: lineItems,
          mode: "payment",
          success_url: `${appUrl}/invoice/${invoiceId}/success?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${appUrl}/invoice/${invoiceId}/pay?token=${invoice.access_token}`,
          customer_email: invoice.client_email,
          metadata,
          payment_intent_data: {
            application_fee_amount: applicationFee, // 3% platform fee
            metadata: {
              invoice_id: invoiceId,
              merchant_id: merchant.id,
              pawbucks_used: String(pawbucksUsed || 0),
              user_id: userId || "",
              charge_type: "direct",
            },
          },
          billing_address_collection: "auto",
        },
        {
          stripeAccount: connectedAccountId, // DIRECT CHARGE: Session on connected account
        }
      );

      logStep("Direct Charge checkout session created", { sessionId: session.id });
    } else {
      // Standard checkout without Connect (platform-only)
      logStep(`Creating platform checkout for merchant ${merchant.id} (no valid Connect account)`);
      
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

      logStep("Platform checkout session created", { sessionId: session.id });
    }

    // If using PawBucks as part of payment, deduct now
    if (pawbucksAmountCents > 0 && userId) {
      const { data: wallet, error: walletError } = await supabase
        .from("pawbucks_wallet")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!walletError && wallet && wallet.balance >= pawbucksUsed) {
        await supabase
          .from("pawbucks_wallet")
          .update({ 
            balance: wallet.balance - pawbucksUsed,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);

        await supabase.from("pawbucks_activity").insert({
          user_id: userId,
          type: "redeem",
          amount: -pawbucksUsed,
          description: `Partial payment for Invoice #${invoice.invoice_number}`,
          merchant_id: merchant.id,
        });

        // Credit merchant
        const { data: merchantWallet } = await supabase
          .from("merchant_pawbucks_wallet")
          .select("*")
          .eq("merchant_id", merchant.id)
          .single();

        if (merchantWallet) {
          await supabase
            .from("merchant_pawbucks_wallet")
            .update({ 
              balance: merchantWallet.balance + pawbucksUsed,
              total_earned: (merchantWallet.total_earned || 0) + pawbucksUsed,
            })
            .eq("merchant_id", merchant.id);
        } else {
          await supabase.from("merchant_pawbucks_wallet").insert({
            merchant_id: merchant.id,
            balance: pawbucksUsed,
            total_earned: pawbucksUsed,
          });
        }

        await supabase.from("merchant_pawbucks_activity").insert({
          merchant_id: merchant.id,
          type: "earn",
          amount: pawbucksUsed,
          description: `Partial invoice payment - Invoice #${invoice.invoice_number}`,
          user_id: userId,
        });

        logStep("PawBucks deducted for mixed payment", { pawbucksUsed });
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        checkoutUrl: session.url,
        sessionId: session.id,
        connectedAccountId: isConnectValid ? connectedAccountId : null, // Frontend may need this
        pawbucksUsed: pawbucksUsed || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
