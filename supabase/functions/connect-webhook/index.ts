import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONNECT-WEBHOOK] ${step}`, details ? JSON.stringify(details) : "");
};

// Helper function to send receipt email (for non-invoice payments)
async function sendReceiptEmail(params: {
  email: string;
  customerName?: string;
  transactionDate: string;
  receiptId: string;
  merchantName: string;
  items: { name: string; price: number }[];
  subtotal: number;
  pawbucksApplied: number;
  cardAmount: number;
  totalPaid: number;
  pawbucksEarned?: number;
  tierInfo?: { tierName: string; multiplier: number };
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      logStep("Skipping receipt email: config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send receipt email:", errorText);
    } else {
      logStep(`Receipt email sent to ${params.email}`);
    }
  } catch (error) {
    console.error("Error sending receipt email:", error);
  }
}

// Helper function to send invoice-specific receipt email (includes line items, payment history)
async function sendInvoiceReceiptEmail(invoiceId: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      logStep("Skipping invoice receipt email: config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice-receipt`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify({ invoiceId, isResend: false }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Failed to send invoice receipt email:", errorText);
    } else {
      logStep(`Invoice receipt email sent for invoice ${invoiceId}`);
    }
  } catch (error) {
    console.error("Error sending invoice receipt email:", error);
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Webhook received", { method: req.method });

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    // Use the dedicated Connect webhook secret for connected account events
    const webhookSecret = Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
    
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");
    if (!webhookSecret) throw new Error("No webhook secret configured");
    
    logStep("Using webhook secret", { hasConnectSecret: !!Deno.env.get("STRIPE_CONNECT_WEBHOOK_SECRET") });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      throw new Error("No Stripe signature found");
    }

    const body = await req.text();
    
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret);
    } catch (err) {
      // Try alternate secret
      const altSecret = Deno.env.get("STRIPE_PLATFORM_WEBHOOK_SECRET") || Deno.env.get("STRIPE_WEBHOOK_SECRET");
      if (altSecret && altSecret !== webhookSecret) {
        try {
          event = await stripe.webhooks.constructEventAsync(body, signature, altSecret);
          logStep("Verified with alternate webhook secret");
        } catch {
          logStep("Webhook signature verification failed with both secrets", { error: String(err) });
          return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
        }
      } else {
        logStep("Webhook signature verification failed", { error: String(err) });
        return new Response(JSON.stringify({ error: "Invalid signature" }), { status: 400 });
      }
    }

    logStep("Event verified", { type: event.type, id: event.id });

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // IDEMPOTENCY CHECK: Skip if already processed
    const { data: existingLog } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingLog) {
      logStep('Duplicate event, skipping', { eventId: event.id });
      return new Response(JSON.stringify({ received: true, duplicate: true }), { status: 200 });
    }

    // Log the event
    await supabaseAdmin.from('webhook_logs').insert({
      event_id: event.id,
      event_type: event.type,
      payload: event as any,
      processed: false,
    });

    // Connected account context (for Direct Charges)
    const connectedAccountId = event.account;
    if (connectedAccountId) {
      logStep("Event from connected account", { accountId: connectedAccountId });
    }

    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const metadata = paymentIntent.metadata || {};
        
        logStep("Processing payment_intent.succeeded", { 
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          metadata: paymentIntent.metadata,
          connectedAccount: connectedAccountId,
        });

        // ========================================
        // HANDLE INVOICE PAYMENTS (from checkout sessions with Connect destination)
        // Also handle legacy charge_type: direct with invoice_id
        // ========================================
        const isInvoicePayment = (metadata.type === 'invoice_payment' || 
          (metadata.charge_type === 'direct' && metadata.invoice_id)) && metadata.invoice_id;
        
        if (isInvoicePayment) {
          const invoiceId = metadata.invoice_id;
          const merchantId = metadata.merchant_id;
          const invoicePayerUserId = metadata.user_id;
          const tipAmount = parseInt(metadata.tip_amount || '0');
          const pawbucksUsed = parseInt(metadata.pawbucks_used || '0');
          const pawbucksAmountCents = parseInt(metadata.pawbucks_amount_cents || '0');
          
          logStep("Processing invoice payment", {
            invoiceId,
            merchantId,
            userId: invoicePayerUserId,
            amount: paymentIntent.amount,
            tipAmount,
            pawbucksUsed,
            pawbucksAmountCents,
          });

          // Check if invoice payment already exists (idempotency)
          const { data: existingInvoicePayment } = await supabaseAdmin
            .from('invoice_payments')
            .select('id')
            .eq('stripe_payment_intent_id', paymentIntent.id)
            .maybeSingle();

          if (existingInvoicePayment) {
            logStep('Invoice payment already exists, skipping', { paymentId: existingInvoicePayment.id });
            await supabaseAdmin.from('webhook_logs')
              .update({ processed: true })
              .eq('event_id', event.id);
            return new Response(JSON.stringify({ received: true, skipped: 'invoice_already_processed' }), { status: 200 });
          }

          const cardPaymentAmount = paymentIntent.amount / 100;
          const pawbucksPaymentAmount = pawbucksAmountCents / 100; // Convert cents to dollars
          const totalPaymentAmount = cardPaymentAmount + pawbucksPaymentAmount;
          const stripeAmountForRewards = cardPaymentAmount - (tipAmount / 100); // Exclude tip from rewards

          // Record card payment in invoice_payments table
          const { data: cardPayment, error: cardPaymentError } = await supabaseAdmin
            .from('invoice_payments')
            .insert({
              invoice_id: invoiceId,
              amount: cardPaymentAmount,
              payment_method: 'credit_card',
              payment_date: new Date().toISOString(),
              status: 'completed',
              stripe_payment_intent_id: paymentIntent.id,
              notes: tipAmount > 0 ? `Includes $${(tipAmount / 100).toFixed(2)} tip` : null,
            })
            .select()
            .single();

          if (cardPaymentError) {
            logStep("Error recording card payment", { error: cardPaymentError.message });
          } else {
            logStep("Card payment recorded", { paymentId: cardPayment.id, amount: cardPaymentAmount });
          }

          // IMPORTANT: Record PawBucks payment as a separate entry if PawBucks were used
          // This ensures the invoice shows fully paid when combining card + PawBucks
          let pawbucksPayment = null;
          if (pawbucksUsed > 0 && pawbucksPaymentAmount > 0) {
            const { data: pbPayment, error: pbPaymentError } = await supabaseAdmin
              .from('invoice_payments')
              .insert({
                invoice_id: invoiceId,
                amount: pawbucksPaymentAmount,
                payment_method: 'pawbucks',
                payment_date: new Date().toISOString(),
                status: 'completed',
                notes: `Paid with ${pawbucksUsed} PawBucks`,
              })
              .select()
              .single();

            if (pbPaymentError) {
              logStep("Error recording PawBucks payment", { error: pbPaymentError.message });
            } else {
              pawbucksPayment = pbPayment;
              logStep("PawBucks payment recorded", { paymentId: pbPayment.id, amount: pawbucksPaymentAmount, pawbucksUsed });
            }
          }

          // Log activity with full payment details
          await supabaseAdmin
            .from('invoice_activity')
            .insert({
              invoice_id: invoiceId,
              action: 'payment_completed',
              description: pawbucksUsed > 0 
                ? `Payment of $${totalPaymentAmount.toFixed(2)} completed ($${cardPaymentAmount.toFixed(2)} card + $${pawbucksPaymentAmount.toFixed(2)} PawBucks)`
                : `Payment of $${cardPaymentAmount.toFixed(2)} completed via Stripe`,
              metadata: {
                payment_intent_id: paymentIntent.id,
                tip_amount: tipAmount,
                pawbucks_used: pawbucksUsed,
                card_payment_id: cardPayment?.id,
                pawbucks_payment_id: pawbucksPayment?.id,
              },
            });

          // Award PawBucks to invoice payer
          let pawbucksEarned = 0;
          let tierName = 'Free';
          let pawbucksMultiplier = 10;

          if (invoicePayerUserId && stripeAmountForRewards > 0) {

            try {
              const { data: platformSub } = await supabaseAdmin
                .from('subscriptions')
                .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at')
                .eq('user_id', invoicePayerUserId)
                .in('status', ['active', 'trialing'])
                .maybeSingle();

              if (platformSub?.is_manual_upgrade && platformSub?.subscription_tier) {
                const expiresAt = platformSub.expires_at ? new Date(platformSub.expires_at) : null;
                if (!expiresAt || expiresAt > new Date()) {
                  if (platformSub.subscription_tier === 'pawpass_plus') {
                    pawbucksMultiplier = 30;
                    tierName = 'PawPass+';
                  } else if (platformSub.subscription_tier === 'pawpass') {
                    pawbucksMultiplier = 20;
                    tierName = 'PawPass';
                  }
                }
              } else if (platformSub?.stripe_subscription_id) {
                const stripeSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
                const productId = stripeSubscription.items.data[0]?.price?.product;

                if (productId === 'prod_TQyZjYzt9DwoIK') {
                  pawbucksMultiplier = 30;
                  tierName = 'PawPass+';
                } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
                  pawbucksMultiplier = 20;
                  tierName = 'PawPass';
                }
              }
            } catch (tierError) {
              logStep("Error determining tier", { error: String(tierError) });
            }

            pawbucksEarned = Math.floor(stripeAmountForRewards * pawbucksMultiplier);

            if (pawbucksEarned > 0) {
              // Get or create wallet
              let { data: wallet } = await supabaseAdmin
                .from('pawbucks_wallet')
                .select('balance')
                .eq('user_id', invoicePayerUserId)
                .single();

              if (!wallet) {
                const { data: newWallet } = await supabaseAdmin
                  .from('pawbucks_wallet')
                  .insert({ user_id: invoicePayerUserId, balance: 0 })
                  .select()
                  .single();
                wallet = newWallet;
              }

              if (wallet) {
                await supabaseAdmin
                  .from('pawbucks_wallet')
                  .update({ balance: wallet.balance + pawbucksEarned })
                  .eq('user_id', invoicePayerUserId);

                // Get invoice number for proper description
                const { data: invoiceForActivity } = await supabaseAdmin
                  .from('invoices')
                  .select('invoice_number')
                  .eq('id', invoiceId)
                  .single();
                const invoiceNumber = invoiceForActivity?.invoice_number || 'Invoice';

                await supabaseAdmin.from('pawbucks_activity').insert({
                  user_id: invoicePayerUserId,
                  amount: pawbucksEarned,
                  type: 'earn',
                  source: 'Invoice Payment',
                  partner_id: merchantId || null,
                  description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from $${stripeAmountForRewards.toFixed(2)} payment on Invoice #${invoiceNumber}`,
                  pawbucks_status: 'available',
                });

                logStep("PawBucks awarded", { pawbucksEarned, tierName });
              }
            }
          }

          // Create transaction record
          if (invoicePayerUserId && merchantId) {
            const { data: invoiceForTx } = await supabaseAdmin
              .from('invoices')
              .select('invoice_number')
              .eq('id', invoiceId)
              .single();

            const { data: merchantForTx } = await supabaseAdmin
              .from('merchants')
              .select('business_name')
              .eq('id', merchantId)
              .single();

            const totalTransactionAmount = cardPaymentAmount + pawbucksPaymentAmount;
            const platformFee = cardPaymentAmount * 0.03; // 3% fee on Stripe portion only

            const { data: transaction, error: transactionError } = await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: invoicePayerUserId,
                merchant_id: merchantId,
                amount: totalTransactionAmount,
                stripe_amount: cardPaymentAmount,
                pawbucks_used: pawbucksUsed,
                application_fee: platformFee,
                cashback_earned: pawbucksEarned,
                rewards_earned: pawbucksEarned,
                description: `Invoice #${invoiceForTx?.invoice_number || 'Payment'}${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`,
                status: 'completed',
                stripe_payment_intent_id: paymentIntent.id,
              })
              .select()
              .single();

            if (transactionError) {
              logStep("Error creating transaction", { error: transactionError.message });
            } else {
              logStep("Transaction created", { transactionId: transaction?.id });
            }

            // ========================================
            // CREDIT PAWBUCKS TO MERCHANT (when customer uses PawBucks for invoice)
            // ========================================
            if (pawbucksUsed > 0 && merchantId) {
              const { data: merchantWallet } = await supabaseAdmin
                .from('merchant_pawbucks_wallet')
                .select('balance')
                .eq('merchant_id', merchantId)
                .single();

              if (merchantWallet) {
                await supabaseAdmin
                  .from('merchant_pawbucks_wallet')
                  .update({ balance: merchantWallet.balance + pawbucksUsed })
                  .eq('merchant_id', merchantId);
              } else {
                await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
                  merchant_id: merchantId,
                  balance: pawbucksUsed,
                });
              }

              await supabaseAdmin.from('merchant_pawbucks_activity').insert({
                merchant_id: merchantId,
                type: 'earn',
                amount: pawbucksUsed,
                source: 'Invoice Payment',
                customer_user_id: invoicePayerUserId,
                description: `Received ${pawbucksUsed} PawBucks from invoice payment`,
              });

              logStep("PawBucks credited to merchant from invoice payment", { merchantId, pawbucksUsed });
            }

            // NOTE: Merchants only earn PawBucks when customers USE PawBucks in payment
            // No commission on card-only payments

            // Send invoice-specific receipt email to customer (includes line items, payment history)
            await sendInvoiceReceiptEmail(invoiceId);

            // Send merchant notification
            try {
              const { data: invoiceForNotif } = await supabaseAdmin
                .from('invoices')
                .select('invoice_number, title, client_name, client_email, total, amount_due')
                .eq('id', invoiceId)
                .single();

              const { data: merchantForNotif } = await supabaseAdmin
                .from('merchants')
                .select('business_name, user_id')
                .eq('id', merchantId)
                .single();

              if (merchantForNotif?.user_id) {
                const { data: merchantProfile } = await supabaseAdmin
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', merchantForNotif.user_id)
                  .single();

                if (merchantProfile?.email) {
                  const supabaseUrl = Deno.env.get('SUPABASE_URL');
                  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

                  if (supabaseUrl && supabaseAnonKey) {
                    await fetch(`${supabaseUrl}/functions/v1/send-invoice-paid-notification`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                      },
                      body: JSON.stringify({
                        merchantEmail: merchantProfile.email,
                        merchantName: merchantProfile.full_name || merchantForNotif.business_name || 'Merchant',
                        invoiceNumber: invoiceForNotif?.invoice_number || 'N/A',
                        invoiceTitle: invoiceForNotif?.title || undefined,
                        clientName: invoiceForNotif?.client_name || 'Customer',
                        clientEmail: invoiceForNotif?.client_email || '',
                        amountPaid: totalPaymentAmount,
                        tipAmount: tipAmount > 0 ? tipAmount / 100 : 0,
                        pawbucksUsed: pawbucksUsed,
                        paymentMethod: pawbucksUsed > 0 ? 'mixed' : 'credit_card',
                        paymentDate: new Date().toISOString(),
                        invoiceTotal: invoiceForNotif?.total || totalPaymentAmount,
                        amountDue: invoiceForNotif?.amount_due || 0,
                        invoiceId: invoiceId,
                      }),
                    });
                  }
                }
              }
            } catch (notifError) {
              logStep("Error sending merchant notification", { error: String(notifError) });
            }
          }

          logStep("Invoice payment processing complete");
          
          await supabaseAdmin.from('webhook_logs')
            .update({ processed: true })
            .eq('event_id', event.id);

          return new Response(JSON.stringify({ received: true, type: 'invoice_payment' }), { status: 200 });
        }

        // Check if this is a merchant subscription renewal payment
        if (metadata.subscription_type === "merchant_recurring" && metadata.billing_type === "renewal") {
          logStep("Subscription renewal payment - handled by cron job", {
            subscriptionId: metadata.merchant_subscription_id
          });
          
          // Mark webhook as processed - cron job handles the subscription update
          await supabaseAdmin.from('webhook_logs')
            .update({ processed: true })
            .eq('event_id', event.id);
          
          return new Response(JSON.stringify({ received: true, type: 'subscription_renewal' }), { status: 200 });
        }

        // Check if transaction already exists (idempotency)
        const { data: existingTx } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntent.id)
          .maybeSingle();

        if (existingTx) {
          logStep('Transaction already exists, skipping', { transactionId: existingTx.id });
          
          // Mark webhook as processed
          await supabaseAdmin.from('webhook_logs')
            .update({ processed: true })
            .eq('event_id', event.id);
            
          return new Response(JSON.stringify({ received: true, skipped: 'already_processed' }), { status: 200 });
        }

        const userId = metadata.user_id;
        const merchantId = metadata.merchant_id;
        const businessName = metadata.business_name || "Merchant";
        const description = metadata.description || `Payment to ${businessName}`;
        const chargeType = metadata.charge_type || "direct";
        const pawbucksAmount = parseInt(metadata.pawbucks_amount || "0", 10);
        const totalAmount = parseFloat(metadata.total_amount || "0");

        // Update direct_payments status
        const { error: updateError } = await supabaseAdmin
          .from("direct_payments")
          .update({ status: "succeeded" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        if (updateError) {
          logStep("Error updating direct_payment status", { error: updateError.message });
        } else {
          logStep("Direct payment status updated to succeeded");
        }

        // Calculate amounts
        const amountInDollars = paymentIntent.amount / 100;
        const platformFee = amountInDollars * 0.03; // 3% platform fee

        // Determine PawBucks multiplier based on subscription tier
        let pawbucksMultiplier = 10;
        let tierName = 'Free';

        if (userId) {
          try {
            // Check for manual subscription first
            const { data: platformSub } = await supabaseAdmin
              .from('subscriptions')
              .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at')
              .eq('user_id', userId)
              .in('status', ['active', 'trialing'])
              .maybeSingle();

            if (platformSub?.is_manual_upgrade && platformSub?.subscription_tier) {
              const expiresAt = platformSub.expires_at ? new Date(platformSub.expires_at) : null;
              if (!expiresAt || expiresAt > new Date()) {
                if (platformSub.subscription_tier === 'pawpass_plus') {
                  pawbucksMultiplier = 30;
                  tierName = 'PawPass+';
                } else if (platformSub.subscription_tier === 'pawpass') {
                  pawbucksMultiplier = 20;
                  tierName = 'PawPass';
                }
              }
            } else if (platformSub?.stripe_subscription_id) {
              const stripeSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
              const productId = stripeSubscription.items.data[0]?.price?.product;
              
              if (productId === 'prod_TQyZjYzt9DwoIK') {
                pawbucksMultiplier = 30;
                tierName = 'PawPass+';
              } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
                pawbucksMultiplier = 20;
                tierName = 'PawPass';
              }
            }
            logStep("Subscription tier determined", { tierName, pawbucksMultiplier });
          } catch (subError) {
            logStep("Error determining subscription tier", { error: String(subError) });
          }
        }

        // PawBucks earned on Stripe amount only
        const pawbucksEarned = Math.floor(amountInDollars * pawbucksMultiplier);

        // Create transaction record
        if (userId && merchantId) {
          const { data: transaction, error: txError } = await supabaseAdmin
            .from("transactions")
            .insert({
              user_id: userId,
              merchant_id: merchantId,
              amount: totalAmount > 0 ? totalAmount : amountInDollars,
              stripe_amount: amountInDollars,
              pawbucks_used: pawbucksAmount,
              application_fee: platformFee,
              status: "completed",
              rewards_earned: pawbucksEarned,
              cashback_earned: pawbucksEarned,
              stripe_payment_intent_id: paymentIntent.id,
              description: description,
            })
            .select()
            .single();

          if (txError) {
            logStep("Error creating transaction", { error: txError.message });
          } else {
            logStep("Transaction created", { transactionId: transaction?.id, pawbucksEarned });
          }

          // Award PawBucks to user
          if (pawbucksEarned > 0) {
            // Log activity - MUST be 'earn' type for wallet display
            await supabaseAdmin.from("pawbucks_activity").insert({
              user_id: userId,
              amount: pawbucksEarned,
              type: "earn",
              source: "direct_payment",
              description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from $${amountInDollars.toFixed(2)} payment to ${businessName}`,
              pawbucks_status: "available",
              partner_id: merchantId,
              transaction_id: transaction?.id,
            });

            // Update wallet balance
            const { data: wallet } = await supabaseAdmin
              .from('pawbucks_wallet')
              .select('balance')
              .eq('user_id', userId)
              .single();

            if (wallet) {
              await supabaseAdmin
                .from('pawbucks_wallet')
                .update({ balance: wallet.balance + pawbucksEarned })
                .eq('user_id', userId);
              
              logStep("PawBucks wallet updated", { 
                previousBalance: wallet.balance, 
                newBalance: wallet.balance + pawbucksEarned 
              });
            } else {
              // Create wallet if doesn't exist
              await supabaseAdmin.from('pawbucks_wallet').insert({
                user_id: userId,
                balance: pawbucksEarned,
              });
              logStep("PawBucks wallet created with initial balance");
          }
          }

          // ========================================
          // CREDIT PAWBUCKS TO MERCHANT (when customer uses PawBucks)
          // ========================================
          if (pawbucksAmount > 0 && merchantId) {
            // Credit merchant's PawBucks wallet with the PawBucks customer used
            const { data: merchantWallet } = await supabaseAdmin
              .from('merchant_pawbucks_wallet')
              .select('balance')
              .eq('merchant_id', merchantId)
              .single();

            if (merchantWallet) {
              await supabaseAdmin
                .from('merchant_pawbucks_wallet')
                .update({ balance: merchantWallet.balance + pawbucksAmount })
                .eq('merchant_id', merchantId);
            } else {
              await supabaseAdmin.from('merchant_pawbucks_wallet').insert({
                merchant_id: merchantId,
                balance: pawbucksAmount,
              });
            }

            // Log merchant activity for receiving PawBucks
            await supabaseAdmin.from('merchant_pawbucks_activity').insert({
              merchant_id: merchantId,
              type: 'earn',
              amount: pawbucksAmount,
              source: 'Customer Payment',
              customer_user_id: userId,
              description: `Received ${pawbucksAmount} PawBucks from customer payment`,
            });

            logStep("PawBucks credited to merchant", { merchantId, pawbucksAmount });
          }

          // NOTE: Merchants only earn PawBucks when customers USE PawBucks in payment
          // No commission on card-only payments

          // Auto-log platform fee AND Stripe processing fee as separate Tax Vault expenses
          if (merchantId && amountInDollars > 0) {
            const expenseDate = new Date().toISOString().split('T')[0];
            const taxYear = new Date().getFullYear();

            // Retrieve actual Stripe processing fee from charge's balance_transaction
            let stripeProcessingFee = 0;
            try {
              const chargeId = typeof paymentIntent.latest_charge === 'string' 
                ? paymentIntent.latest_charge 
                : paymentIntent.latest_charge?.id;
              
              if (chargeId) {
                const charge = await stripe.charges.retrieve(chargeId, {
                  expand: ['balance_transaction'],
                }, { stripeAccount: connectedAccountId });
                
                if (charge.balance_transaction && typeof charge.balance_transaction === 'object') {
                  const totalStripeFee = (charge.balance_transaction as Stripe.BalanceTransaction).fee / 100;
                  stripeProcessingFee = Math.max(0, totalStripeFee - platformFee);
                }
              }
            } catch (feeError) {
              logStep("Could not retrieve Stripe processing fee, estimating", { error: String(feeError) });
              stripeProcessingFee = Math.round((amountInDollars * 0.029 + 0.30) * 100) / 100;
            }

            const expenseRows = [];

            // PawBucks Platform Fee (3%)
            if (platformFee > 0) {
              expenseRows.push({
                merchant_id: merchantId,
                category: "platform_fees" as const,
                amount: platformFee,
                description: `PawBucks Platform Fee (3%) on $${amountInDollars.toFixed(2)} sale`,
                vendor_name: "PawBucks Platform",
                expense_date: expenseDate,
                tax_year: taxYear,
                is_auto_logged: true,
                source_purchase_id: paymentIntent.id,
              });
            }

            // Stripe Processing Fee
            if (stripeProcessingFee > 0) {
              expenseRows.push({
                merchant_id: merchantId,
                category: "processing_fees" as const,
                amount: stripeProcessingFee,
                description: `Stripe Processing Fee on $${amountInDollars.toFixed(2)} sale`,
                vendor_name: "Stripe",
                expense_date: expenseDate,
                tax_year: taxYear,
                is_auto_logged: true,
                source_purchase_id: `${paymentIntent.id}_processing`,
              });
            }

            if (expenseRows.length > 0) {
              await supabaseAdmin.from("merchant_tax_expenses").insert(expenseRows);
              logStep("Fees auto-logged to Tax Vault", { platformFee, stripeProcessingFee });
            }
          }

          // Send receipt email
          const { data: userProfile } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('id', userId)
            .single();

          if (userProfile?.email) {
            await sendReceiptEmail({
              email: userProfile.email,
              customerName: userProfile.full_name || undefined,
              transactionDate: new Date().toISOString(),
              receiptId: transaction?.id || paymentIntent.id,
              merchantName: businessName,
              items: [{ name: `Payment to ${businessName}`, price: totalAmount > 0 ? totalAmount : amountInDollars }],
              subtotal: totalAmount > 0 ? totalAmount : amountInDollars,
              pawbucksApplied: pawbucksAmount * 0.001,
              cardAmount: amountInDollars,
              totalPaid: totalAmount > 0 ? totalAmount : amountInDollars,
              pawbucksEarned,
              tierInfo: {
                tierName,
                multiplier: pawbucksMultiplier,
              },
            });
          }

          // Send in-app notification and email to merchant
          if (merchantId) {
            try {
              const { data: merchantForNotif } = await supabaseAdmin
                .from('merchants')
                .select('business_name, user_id')
                .eq('id', merchantId)
                .single();

              if (merchantForNotif?.user_id) {
                // In-app notification
                await supabaseAdmin.from("notifications").insert({
                  user_id: merchantForNotif.user_id,
                  title: "💰 New Payment Received",
                  message: `${userProfile?.full_name || 'A customer'} paid $${(totalAmount > 0 ? totalAmount : amountInDollars).toFixed(2)} for ${description}.`,
                  category: "transactional",
                });

                // Email notification
                const { data: merchantProfile } = await supabaseAdmin
                  .from('profiles')
                  .select('email, full_name')
                  .eq('id', merchantForNotif.user_id)
                  .single();

                if (merchantProfile?.email) {
                  const supabaseUrl = Deno.env.get('SUPABASE_URL');
                  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

                  if (supabaseUrl && supabaseAnonKey) {
                    fetch(`${supabaseUrl}/functions/v1/send-invoice-paid-notification`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${supabaseAnonKey}`,
                      },
                      body: JSON.stringify({
                        merchantEmail: merchantProfile.email,
                        merchantName: merchantProfile.full_name || merchantForNotif.business_name || 'Merchant',
                        invoiceNumber: `PAY-${(transaction?.id || paymentIntent.id).substring(0, 8).toUpperCase()}`,
                        invoiceTitle: description,
                        clientName: userProfile?.full_name || 'Customer',
                        clientEmail: userProfile?.email || '',
                        amountPaid: totalAmount > 0 ? totalAmount : amountInDollars,
                        pawbucksUsed: pawbucksAmount,
                        paymentMethod: pawbucksAmount > 0 ? 'mixed' : 'credit_card',
                        paymentDate: new Date().toISOString(),
                        invoiceTotal: totalAmount > 0 ? totalAmount : amountInDollars,
                        amountDue: 0,
                      }),
                    }).catch(err => logStep("Merchant notification error", { error: String(err) }));
                  }
                }
              }
            } catch (notifError) {
              logStep("Error sending merchant notification", { error: String(notifError) });
            }
          }

          // Generate Pet Timeline moment for this transaction
          if (transaction?.id) {
            try {
              // Get user's pet (first pet for now - could be enhanced to select based on merchant category)
              const { data: userPets } = await supabaseAdmin
                .from('pet_profiles')
                .select('id, name, type')
                .eq('user_id', userId)
                .limit(1);

              if (userPets && userPets.length > 0) {
                const pet = userPets[0];
                
                // Get merchant category from database
                const { data: merchantDetails } = await supabaseAdmin
                  .from('merchants')
                  .select('business_type')
                  .eq('id', merchantId)
                  .single();

                // Trigger timeline moment generation (fire and forget)
                const supabaseUrl = Deno.env.get("SUPABASE_URL");
                fetch(`${supabaseUrl}/functions/v1/generate-timeline-moment`, {
                  method: "POST",
                  headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  },
                  body: JSON.stringify({
                    transactionId: transaction.id,
                    petId: pet.id,
                    userId,
                    petName: pet.name,
                    petType: pet.type,
                    merchantName: businessName,
                    merchantCategory: merchantDetails?.business_type || description,
                    amount: totalAmount > 0 ? totalAmount : amountInDollars,
                    pawbucksEarned,
                    description,
                  }),
                }).catch(err => console.error("[CONNECT-WEBHOOK] Timeline moment error:", err));

                logStep("Timeline moment generation triggered", { petId: pet.id });
              }
            } catch (timelineError) {
              // Don't fail the webhook for timeline errors
              console.error("[CONNECT-WEBHOOK] Error triggering timeline moment:", timelineError);
            }

            // Check for Guilt-Free Badges (gamification)
            try {
              const { data: merchantForBadge } = await supabaseAdmin
                .from('merchants')
                .select('business_type')
                .eq('id', merchantId)
                .single();

              const supabaseUrlEnv = Deno.env.get("SUPABASE_URL");
              fetch(`${supabaseUrlEnv}/functions/v1/check-guilt-badges`, {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                },
                body: JSON.stringify({
                  userId,
                  transactionAmount: totalAmount > 0 ? totalAmount : amountInDollars,
                  merchantCategory: merchantForBadge?.business_type || 'other',
                  transactionId: paymentIntentId,
                }),
              }).catch(err => console.error("[CONNECT-WEBHOOK] Badge check error:", err));

              logStep("Badge check triggered");
            } catch (badgeError) {
              console.error("[CONNECT-WEBHOOK] Error triggering badge check:", badgeError);
            }
          }
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        logStep("Payment failed", { 
          paymentIntentId: paymentIntent.id,
          error: paymentIntent.last_payment_error?.message 
        });

        await supabaseAdmin
          .from("direct_payments")
          .update({ status: "failed" })
          .eq("stripe_payment_intent_id", paymentIntent.id);

        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        logStep("Account updated", { 
          accountId: account.id,
          chargesEnabled: account.charges_enabled,
          payoutsEnabled: account.payouts_enabled,
        });

        const isComplete = account.charges_enabled && account.payouts_enabled;
        const hasPendingRequirements = 
          (account.requirements?.currently_due?.length || 0) > 0 ||
          (account.requirements?.past_due?.length || 0) > 0;

        await supabaseAdmin
          .from("merchants")
          .update({
            onboarding_complete: isComplete && !hasPendingRequirements,
            stripe_account_status: isComplete ? "active" : "pending",
          })
          .eq("stripe_account_id", account.id);

        break;
      }

      case "payout.paid":
      case "payout.failed":
      case "transfer.created":
        logStep("Handled event", { type: event.type });
        break;

      default:
        logStep("Unhandled event type", { type: event.type });
    }

    // Mark as processed
    await supabaseAdmin.from('webhook_logs')
      .update({ processed: true })
      .eq('event_id', event.id);

    return new Response(JSON.stringify({ received: true }), { status: 200 });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("[CONNECT-WEBHOOK] Error:", errorMessage);
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});