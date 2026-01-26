import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PAWBUCKS_TO_USD = 0.001; // 1 PawBuck = $0.001

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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
      isGuestCheckout, // New flag for guest checkout
    } = await req.json();

    if (!invoiceId || totalAmountCents === undefined) {
      throw new Error("Invoice ID and total amount are required");
    }
    
    // Validate: Guest checkout cannot use PawBucks
    if (isGuestCheckout && pawbucksAmountCents > 0) {
      throw new Error("Guest checkout cannot use PawBucks. Please sign in to use PawBucks.");
    }

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

    // Fetch the merchant FIRST to check accepts_pawbucks
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("*")
      .eq("id", invoice.merchant_id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    // Check if PawBucks are allowed - merchant setting overrides invoice setting
    const acceptsPawbucks = invoice.accept_pawbucks || merchant.accepts_pawbucks;
    if (!acceptsPawbucks && pawbucksAmountCents > 0) {
      throw new Error("This invoice does not accept PawBucks payments");
    }

    const appUrl = Deno.env.get("APP_URL") || "https://paw-bucks-pay.lovable.app";
    const stripeAmountCents = totalAmountCents - pawbucksAmountCents;
    const pawbucksUsed = Math.round(pawbucksAmountCents / PAWBUCKS_TO_USD / 100); // Convert cents to PawBucks

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

    // If paying entirely with PawBucks
    if (stripeAmountCents <= 0 && pawbucksAmountCents > 0) {
      if (!userId) {
        throw new Error("User ID is required for PawBucks payments");
      }

      // Get user's PawBucks wallet
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
      const { data: merchantWallet, error: merchantWalletError } = await supabase
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

      // Create transaction record for PawBucks payment
      const { data: transaction, error: transactionError } = await supabase
        .from("transactions")
        .insert({
          user_id: userId,
          merchant_id: merchant.id,
          amount: paymentAmountUSD,
          stripe_amount: 0, // No Stripe payment
          pawbucks_used: pawbucksUsed,
          application_fee: 0, // No platform fee on PawBucks-only payments
          cashback_earned: 0, // No PawBucks earned for all-PawBucks payments
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
        console.log("✅ Transaction recorded:", transaction.id);
      }

      // Send receipt email
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
            pawbucksEarned: 0, // No PawBucks earned for all-PawBucks payments
            pawbucksUsed: pawbucksUsed,
            description: `Invoice #${invoice.invoice_number}`,
          },
        });
      } catch (emailError) {
        console.error("Error sending receipt email:", emailError);
      }

      // Send merchant notification for invoice paid
      try {
        // Get merchant user email
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
              amountPaid: 0, // All PawBucks payment, no card charge
              tipAmount: tipAmountCents > 0 ? tipAmountCents / 100 : 0,
              pawbucksUsed: pawbucksUsed,
              paymentMethod: "pawbucks" as const,
              paymentDate: new Date().toISOString(),
              invoiceTotal: invoice.total,
              amountDue: invoice.total - paymentAmountUSD - (invoice.amount_paid || 0),
              invoiceId: invoiceId,
            },
          });
          console.log("✅ Merchant invoice paid notification sent to:", merchantProfile.email);
        }
      } catch (notifError) {
        console.error("Error sending merchant notification:", notifError);
        // Don't fail the payment processing due to notification error
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          paymentMethod: "pawbucks",
          pawbucksUsed,
          amountPaid: paymentAmountUSD,
          pawbucksEarned: 0, // No PawBucks earned for all-PawBucks payments
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Mixed payment or Stripe-only: Create Stripe checkout
    // Note: connectedAccountId and isConnectValid are defined earlier in the function
    
    // Build line items
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

    // Add tip as separate line item
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
    };

    if (isConnectValid && connectedAccountId) {
      // Use Stripe Connect destination charges (Express accounts)
      const totalStripeAmount = stripeAmountCents + (tipAmountCents || 0);
      const applicationFee = Math.round(totalStripeAmount * 0.03); // 3% platform fee

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
          // Note: on_behalf_of is NOT used with destination charges for Express accounts
          metadata: {
            invoice_id: invoiceId,
            merchant_id: merchant.id,
            pawbucks_used: String(pawbucksUsed || 0),
            user_id: userId || "",
          },
        },
        billing_address_collection: "auto",
      });
    } else {
      // Standard checkout without Connect - add merchant info to product description
      console.log(`Creating standard checkout for merchant ${merchant.id} (no valid Connect account)`);
      // Standard checkout without Connect - add merchant info to product description
      // Update line items to include merchant name for better identification
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

    // If using PawBucks as part of payment, deduct now (Stripe portion will be recorded by webhook)
    if (pawbucksAmountCents > 0 && userId) {
      const { data: wallet, error: walletError } = await supabase
        .from("pawbucks_wallet")
        .select("*")
        .eq("user_id", userId)
        .single();

      if (!walletError && wallet && wallet.balance >= pawbucksUsed) {
        // Deduct PawBucks
        await supabase
          .from("pawbucks_wallet")
          .update({ 
            balance: wallet.balance - pawbucksUsed,
            updated_at: new Date().toISOString()
          })
          .eq("user_id", userId);

        // Log activity
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
          description: `Partial Invoice #${invoice.invoice_number} payment`,
          user_id: userId,
        });
      }
    }

    // Log activity
    await supabase.from("invoice_activity").insert({
      invoice_id: invoiceId,
      action: "payment_initiated",
      description: `Payment of $${((stripeAmountCents + (tipAmountCents || 0)) / 100).toFixed(2)} initiated${pawbucksUsed > 0 ? ` with ${pawbucksUsed} PawBucks applied` : ''}`,
      metadata: {
        checkout_session_id: session.id,
        stripe_amount: stripeAmountCents,
        pawbucks_used: pawbucksUsed,
        tip_amount: tipAmountCents || 0,
      },
    });

    return new Response(
      JSON.stringify({ 
        url: session.url, 
        sessionId: session.id,
        pawbucksDeducted: pawbucksUsed > 0,
        pawbucksUsed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error processing invoice payment:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 400 }
    );
  }
});
