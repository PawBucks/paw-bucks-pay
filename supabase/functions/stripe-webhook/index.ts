import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Helper function to send receipt email via dedicated edge function
async function sendReceiptEmail(params: {
  email: string;
  customerName?: string;
  transactionDate: string;
  receiptId: string;
  merchantName: string;
  merchantLocation?: string;
  items: { name: string; price: number }[];
  subtotal: number;
  pawbucksApplied: number;
  cardAmount: number;
  totalPaid: number;
  cardBrand?: string;
  cardLast4?: string;
  pawbucksEarned?: number;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log("[EMAIL] Skipping receipt email: Supabase config not available");
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
      console.error("[EMAIL] Failed to send receipt email:", errorText);
    } else {
      console.log(`[EMAIL] ✅ Receipt email sent to ${params.email}`);
    }
  } catch (error) {
    console.error("[EMAIL] Error sending receipt email:", error);
    // Don't throw - email failure shouldn't break the payment processing
  }
}

// Legacy helper for subscription confirmation emails (simpler format)
async function sendPaymentConfirmationEmail(params: {
  email: string;
  customerName?: string;
  amount: number;
  merchantName: string;
  pawbucksEarned: number;
  orderReference: string;
  isSubscription?: boolean;
}): Promise<void> {
  // For subscriptions, use simplified receipt email
  await sendReceiptEmail({
    email: params.email,
    customerName: params.customerName,
    transactionDate: new Date().toISOString(),
    receiptId: params.orderReference,
    merchantName: params.merchantName,
    items: [{ name: params.isSubscription ? 'Subscription Payment' : 'Purchase', price: params.amount }],
    subtotal: params.amount,
    pawbucksApplied: 0,
    cardAmount: params.amount,
    totalPaid: params.amount,
    pawbucksEarned: params.pawbucksEarned,
  });
}

// Helper function to send merchant invoice paid notification
async function sendInvoicePaidNotification(params: {
  merchantEmail: string;
  merchantName: string;
  invoiceNumber: string;
  invoiceTitle?: string;
  clientName: string;
  clientEmail: string;
  amountPaid: number;
  tipAmount?: number;
  pawbucksUsed?: number;
  paymentMethod: 'credit_card' | 'pawbucks' | 'mixed';
  paymentDate: string;
  invoiceTotal: number;
  amountDue?: number;
  invoiceId: string;
}): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log("[INVOICE_PAID] Skipping merchant notification: Supabase config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-invoice-paid-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[INVOICE_PAID] Failed to send merchant notification:", errorText);
    } else {
      console.log(`[INVOICE_PAID] ✅ Merchant notification sent to ${params.merchantEmail}`);
    }
  } catch (error) {
    console.error("[INVOICE_PAID] Error sending merchant notification:", error);
    // Don't throw - notification failure shouldn't break payment processing
  }
}

// Helper function to send invoice-specific receipt email (includes line items, payment history)
async function sendInvoiceReceiptEmail(invoiceId: string): Promise<void> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
    
    if (!supabaseUrl || !supabaseAnonKey) {
      console.log("[INVOICE_RECEIPT] Skipping invoice receipt email: config not available");
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
      console.error("[INVOICE_RECEIPT] Failed to send invoice receipt email:", errorText);
    } else {
      console.log(`[INVOICE_RECEIPT] ✅ Invoice receipt email sent for invoice ${invoiceId}`);
    }
  } catch (error) {
    console.error("[INVOICE_RECEIPT] Error sending invoice receipt email:", error);
    // Don't throw - email failure shouldn't break payment processing
  }
}

serve(async (req) => {
  console.log('[STRIPE-WEBHOOK] Function invoked, method:', req.method);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[STRIPE-WEBHOOK] Processing webhook request');
    console.log('[STRIPE-WEBHOOK] Headers:', JSON.stringify(Object.fromEntries(req.headers.entries())));
    
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // SECURITY: Verify webhook signature - try both platform and connected account secrets
    const connectedWebhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    const platformWebhookSecret = Deno.env.get('STRIPE_PLATFORM_WEBHOOK_SECRET');
    
    if (!connectedWebhookSecret && !platformWebhookSecret) {
      console.error('No webhook secrets configured');
      return new Response(
        JSON.stringify({ error: 'Webhook configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let event;
    let verificationSucceeded = false;
    
    // Try platform webhook secret first (for payment_intent.succeeded, checkout.session.completed, etc.)
    if (platformWebhookSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature!, platformWebhookSecret);
        verificationSucceeded = true;
        console.log('[STRIPE-WEBHOOK] Verified with platform webhook secret');
      } catch (err) {
        console.log('[STRIPE-WEBHOOK] Platform secret verification failed, trying connected account secret...');
      }
    }
    
    // Try connected accounts webhook secret (for payout.paid, account.updated, etc.)
    if (!verificationSucceeded && connectedWebhookSecret) {
      try {
        event = await stripe.webhooks.constructEventAsync(body, signature!, connectedWebhookSecret);
        verificationSucceeded = true;
        console.log('[STRIPE-WEBHOOK] Verified with connected accounts webhook secret');
      } catch (err: unknown) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown error';
        console.error('Webhook signature verification failed with both secrets:', errorMessage);
      }
    }
    
    if (!verificationSucceeded || !event) {
      return new Response(
        JSON.stringify({ error: 'Webhook signature verification failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    console.log('Stripe webhook event:', event.type, 'ID:', event.id);

    // Initialize Supabase client with service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check for duplicate events
    const { data: existingLog } = await supabaseAdmin
      .from('webhook_logs')
      .select('id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (existingLog) {
      console.log('Duplicate event detected, skipping:', event.id);
      return new Response(
        JSON.stringify({ received: true, duplicate: true }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Log webhook event
    const { error: logError } = await supabaseAdmin
      .from('webhook_logs')
      .insert({
        event_id: event.id,
        event_type: event.type,
        payload: event as any,
        processed: false,
      });

    if (logError) {
      console.error('Failed to log webhook event:', logError);
    }

    // ========================================
    // SUBSCRIPTION WEBHOOK HANDLERS
    // ========================================

    // Handle successful checkout session (subscription created)
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object as Stripe.Checkout.Session;
      
      // Get metadata - could be from session or subscription_data
      const metadata = session.metadata || {};
      
      // Handle PawBucks auto-redemption deduction (only NOW after payment completes)
      const pawbucksUsed = parseInt(metadata.pawbucks_used || '0');
      const pawbucksUsdValue = parseFloat(metadata.pawbucks_usd_value || '0');
      const userId = metadata.user_id;
      const merchantId = metadata.merchant_id;
      const merchantName = metadata.product_name || 'Merchant';

      // ========================================
      // DUPLICATE PREVENTION CHECK
      // Skip if this checkout session was already processed
      // ========================================
      const paymentIntentId = session.payment_intent as string;
      if (paymentIntentId) {
        const { data: existingTransaction } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existingTransaction) {
          console.log('[CHECKOUT] ⏭️ Skipping - transaction already exists for payment_intent:', paymentIntentId);
          return new Response(JSON.stringify({ received: true, skipped: 'duplicate_checkout' }), { status: 200 });
        }

        // Also check invoice_payments table for invoice-specific payments
        const { data: existingInvoicePayment } = await supabaseAdmin
          .from('invoice_payments')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .maybeSingle();

        if (existingInvoicePayment) {
          console.log('[CHECKOUT] ⏭️ Skipping - invoice payment already processed for payment_intent:', paymentIntentId);
          return new Response(JSON.stringify({ received: true, skipped: 'invoice_already_processed' }), { status: 200 });
        }
      }

      if (pawbucksUsed > 0 && userId) {
        console.log('Processing PawBucks auto-redemption after payment completion:', {
          pawbucksUsed,
          pawbucksUsdValue,
          userId,
          merchantId,
        });

        // Get current PawBucks balance
        const { data: pawbucksWallet, error: walletError } = await supabaseAdmin
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', userId)
          .single();

        if (!walletError && pawbucksWallet) {
          const currentBalance = pawbucksWallet.balance || 0;
          
          // Verify user still has enough PawBucks (they may have spent them elsewhere)
          const actualDeduction = Math.min(pawbucksUsed, currentBalance);
          
          if (actualDeduction > 0) {
            const newBalance = currentBalance - actualDeduction;
            
            // Deduct PawBucks from user
            const { error: updateError } = await supabaseAdmin
              .from('pawbucks_wallet')
              .update({ balance: newBalance })
              .eq('user_id', userId);

            if (!updateError) {
              // Log PawBucks activity for user (deduction)
              await supabaseAdmin
                .from('pawbucks_activity')
                .insert({
                  user_id: userId,
                  type: 'redeem',
                  amount: -actualDeduction,
                  source: 'Auto-Redemption',
                  partner_id: merchantId || null,
                  description: `Auto-redeemed ${actualDeduction} PawBucks ($${(actualDeduction / 1000).toFixed(2)}) for subscription at ${merchantName}`,
                });

              console.log(`✅ Deducted ${actualDeduction} PawBucks from user wallet after payment completion`);
              
              // Credit merchant's PawBucks wallet
              if (merchantId) {
                // Get or create merchant wallet
                let { data: merchantWallet } = await supabaseAdmin
                  .from('merchant_pawbucks_wallet')
                  .select('balance')
                  .eq('merchant_id', merchantId)
                  .single();
                
                if (!merchantWallet) {
                  // Create wallet if doesn't exist
                  const { data: newWallet } = await supabaseAdmin
                    .from('merchant_pawbucks_wallet')
                    .insert({ merchant_id: merchantId, balance: 0 })
                    .select('balance')
                    .single();
                  merchantWallet = newWallet;
                }
                
                if (merchantWallet) {
                  // Credit merchant
                  const { error: merchantUpdateError } = await supabaseAdmin
                    .from('merchant_pawbucks_wallet')
                    .update({ balance: merchantWallet.balance + actualDeduction })
                    .eq('merchant_id', merchantId);
                  
                  if (!merchantUpdateError) {
                    // Log merchant's PawBucks activity (credit)
                    await supabaseAdmin
                      .from('merchant_pawbucks_activity')
                      .insert({
                        merchant_id: merchantId,
                        type: 'earn',
                        amount: actualDeduction,
                        source: 'Customer Payment',
                        customer_user_id: userId,
                        description: `Received ${actualDeduction} PawBucks ($${(actualDeduction / 1000).toFixed(2)}) from customer subscription payment`,
                      });
                    
                    console.log(`✅ Credited ${actualDeduction} PawBucks to merchant wallet`);
                  } else {
                    console.error('Error crediting merchant PawBucks wallet:', merchantUpdateError);
                  }
                }
              }
            } else {
              console.error('Error deducting PawBucks:', updateError);
            }
          } else {
            console.log('User no longer has enough PawBucks for deduction, skipping');
          }
        } else {
          console.error('Could not find PawBucks wallet for user:', walletError);
        }
      }
      
      // ========================================
      // HANDLE SUBSCRIPTION MODE - Create subscription record and transaction
      // ========================================
      if (session.mode === 'subscription') {
        const subscriptionId = session.subscription as string;
        
        console.log('[SUBSCRIPTION] Checkout session completed:', {
          sessionId: session.id,
          userId,
          merchantId,
          subscriptionId,
          amountTotal: session.amount_total,
          pawbucksUsdValue,
        });

        // STEP 1: Try to create subscription record (non-blocking - don't fail if this fails)
        if (userId && subscriptionId) {
          try {
            const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
              apiVersion: '2024-12-18.acacia',
            });
            
            const subscription = await stripe.subscriptions.retrieve(subscriptionId);
            
            const { error: subError } = await supabaseAdmin
              .from('subscriptions')
              .insert({
                user_id: userId,
                stripe_subscription_id: subscriptionId,
                status: subscription.status,
                start_date: new Date(subscription.start_date * 1000).toISOString(),
                current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
              });

            if (subError) {
              console.error('[SUBSCRIPTION] Error creating subscription record:', subError);
            } else {
              console.log('[SUBSCRIPTION] ✅ Subscription record created');
            }

            // Log subscription event (non-critical)
            await supabaseAdmin
              .from('subscription_events')
              .insert({
                subscription_id: subscriptionId,
                event_type: 'subscription.created',
              }).then(({ error }) => {
                if (error) console.error('[SUBSCRIPTION] Error logging subscription event:', error);
              });
          } catch (subRetrieveError) {
            console.error('[SUBSCRIPTION] Error retrieving subscription details (continuing with transaction):', subRetrieveError);
          }
        }
        
        // STEP 2: Create transaction record (CRITICAL - this must succeed)
        // This runs INDEPENDENTLY of the subscription record creation above
        const stripeAmountPaid = session.amount_total ? session.amount_total / 100 : 0;
        const totalAmount = stripeAmountPaid + pawbucksUsdValue;
        
        console.log('[SUBSCRIPTION] Transaction calculation:', {
          stripeAmountPaid,
          pawbucksUsdValue,
          totalAmount,
          merchantId,
          userId,
        });
        
        if (userId && merchantId && totalAmount > 0) {
          // Determine PawBucks earned based on STRIPE amount only
          let pawbucksMultiplier = 10;
          let tierName = 'Free';
          
          // Check user's platform subscription tier (non-blocking)
          try {
            const { data: platformSub } = await supabaseAdmin
              .from('subscriptions')
              .select('stripe_subscription_id')
              .eq('user_id', userId)
              .in('status', ['active', 'trialing'])
              .maybeSingle();

            if (platformSub?.stripe_subscription_id) {
              const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
                apiVersion: '2024-12-18.acacia',
              });
              const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
              const productId = platformSubscription.items.data[0]?.price?.product;
              
              if (productId === 'prod_TQyZjYzt9DwoIK') {
                pawbucksMultiplier = 30;
                tierName = 'PawPass+';
              } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
                pawbucksMultiplier = 20;
                tierName = 'PawPass';
              }
            }
          } catch (tierError) {
            console.error('[SUBSCRIPTION] Error determining tier (using default):', tierError);
          }
          
          const pawbucksEarned = Math.floor(stripeAmountPaid * pawbucksMultiplier);
          
          console.log('[SUBSCRIPTION] Recording transaction:', {
            userId,
            merchantId,
            totalAmount,
            stripeAmountPaid,
            pawbucksUsedValue: pawbucksUsdValue,
            pawbucksEarned,
            tierName,
          });
          
          // Create transaction record with accurate fee tracking
          // Platform fee (3%) is ONLY on the Stripe portion, NOT on PawBucks portion
          const platformFee = stripeAmountPaid * 0.03;
          // Convert pawbucksUsdValue back to PawBucks amount (1000 PawBucks = $1)
          const pawbucksUsedAmount = Math.floor(pawbucksUsdValue * 1000);
          
          const { data: transaction, error: transactionError } = await supabaseAdmin
            .from('transactions')
            .insert({
              user_id: userId,
              merchant_id: merchantId,
              amount: totalAmount,
              stripe_amount: stripeAmountPaid, // Only the Stripe-charged portion
              pawbucks_used: pawbucksUsedAmount, // PawBucks used for this transaction
              application_fee: platformFee, // 3% fee only on Stripe portion
              cashback_earned: pawbucksEarned,
              rewards_earned: pawbucksEarned,
              description: `Subscription: ${merchantName}`,
              status: 'completed',
              stripe_payment_intent_id: session.payment_intent as string || `checkout_${session.id}`,
            })
            .select()
            .single();

          if (transactionError) {
            console.error('[SUBSCRIPTION] ❌ Error creating transaction:', transactionError);
          } else {
            console.log('[SUBSCRIPTION] ✅ Transaction recorded:', transaction.id);
            
            // Credit PawBucks earned to user's wallet (only for Stripe portion)
            if (pawbucksEarned > 0) {
              try {
                let { data: userWallet } = await supabaseAdmin
                  .from('pawbucks_wallet')
                  .select('*')
                  .eq('user_id', userId)
                  .single();

                if (!userWallet) {
                  const { data: newWallet } = await supabaseAdmin
                    .from('pawbucks_wallet')
                    .insert({ user_id: userId, balance: 0 })
                    .select()
                    .single();
                  userWallet = newWallet;
                }

                if (userWallet) {
                  const { error: walletUpdateError } = await supabaseAdmin
                    .from('pawbucks_wallet')
                    .update({ balance: userWallet.balance + pawbucksEarned })
                    .eq('user_id', userId);

                  if (walletUpdateError) {
                    console.error('[SUBSCRIPTION] Error updating PawBucks wallet:', walletUpdateError);
                  } else {
                    console.log(`[SUBSCRIPTION] ✅ PawBucks wallet updated: +${pawbucksEarned}`);
                    
                    await supabaseAdmin
                      .from('pawbucks_activity')
                      .insert({
                        user_id: userId,
                        type: 'earn',
                        amount: pawbucksEarned,
                        source: 'Subscription Purchase',
                        partner_id: merchantId,
                        transaction_id: transaction.id,
                        description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from subscription at ${merchantName}`,
                      });
                  }
                }
              } catch (walletError) {
                console.error('[SUBSCRIPTION] Error processing PawBucks earned:', walletError);
              }
            }
            
            // Send confirmation email for subscription payment
            const customerEmail = session.customer_email || session.customer_details?.email;
            if (customerEmail) {
              await sendPaymentConfirmationEmail({
                email: customerEmail,
                customerName: session.customer_details?.name || undefined,
                amount: totalAmount,
                merchantName,
                pawbucksEarned,
                orderReference: session.id,
                isSubscription: true,
              });
            } else {
              console.log('[SUBSCRIPTION] No customer email found for confirmation');
            }
          }
        } else {
          console.error('[SUBSCRIPTION] ❌ Missing required data for transaction:', {
            hasUserId: !!userId,
            hasMerchantId: !!merchantId,
            totalAmount,
          });
        }
      }
      
      // ========================================
      // HANDLE INVOICE PAYMENT MODE - Native Platform Invoices
      // ========================================
      if (session.mode === 'payment' && metadata.type === 'invoice_payment') {
        const invoiceId = metadata.invoice_id;
        const tipAmount = parseInt(metadata.tip_amount || '0');
        const pawbucksUsedStr = metadata.pawbucks_used || '0';
        const pawbucksUsed = parseInt(pawbucksUsedStr);
        const invoicePayerUserId = metadata.user_id;
        
        console.log('[INVOICE_PAYMENT] Processing invoice payment:', {
          sessionId: session.id,
          invoiceId,
          merchantId,
          amountTotal: session.amount_total,
          tipAmount,
          pawbucksUsed,
          payerUserId: invoicePayerUserId,
        });
        
        if (invoiceId) {
          const paymentAmount = (session.amount_total || 0) / 100;
          const stripeAmountForRewards = paymentAmount - (tipAmount / 100); // Exclude tip from rewards calculation
          
          // Record payment in invoice_payments table
          const { data: payment, error: paymentError } = await supabaseAdmin
            .from('invoice_payments')
            .insert({
              invoice_id: invoiceId,
              amount: paymentAmount,
              payment_method: 'credit_card',
              payment_date: new Date().toISOString(),
              status: 'completed',
              stripe_payment_intent_id: session.payment_intent as string,
              notes: tipAmount > 0 ? `Includes $${(tipAmount / 100).toFixed(2)} tip` : null,
            })
            .select()
            .single();
          
          if (paymentError) {
            console.error('[INVOICE_PAYMENT] Error recording payment:', paymentError);
          } else {
            console.log('[INVOICE_PAYMENT] ✅ Payment recorded:', payment.id);
          }
          
          // Log activity
          await supabaseAdmin
            .from('invoice_activity')
            .insert({
              invoice_id: invoiceId,
              action: 'payment_completed',
              description: `Payment of $${paymentAmount.toFixed(2)} completed via Stripe`,
              metadata: {
                checkout_session_id: session.id,
                payment_intent_id: session.payment_intent,
                tip_amount: tipAmount,
                pawbucks_used: pawbucksUsed,
              },
            });
          
          // ========================================
          // AWARD PAWBUCKS TO INVOICE PAYER
          // ========================================
          let pawbucksEarned = 0;
          let tierName = 'Free';
          
          if (invoicePayerUserId && stripeAmountForRewards > 0) {
            // Determine PawBucks multiplier based on subscription tier
            let pawbucksMultiplier = 10; // Default 10x for free accounts
            
            try {
              const { data: platformSub } = await supabaseAdmin
                .from('subscriptions')
                .select('stripe_subscription_id')
                .eq('user_id', invoicePayerUserId)
                .in('status', ['active', 'trialing'])
                .maybeSingle();

              if (platformSub?.stripe_subscription_id) {
                const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
                const productId = platformSubscription.items.data[0]?.price?.product;
                
                if (productId === 'prod_TQyZjYzt9DwoIK') {
                  pawbucksMultiplier = 30; // PawPass+
                  tierName = 'PawPass+';
                } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
                  pawbucksMultiplier = 20; // PawPass
                  tierName = 'PawPass';
                }
              }
            } catch (tierError) {
              console.error('[INVOICE_PAYMENT] Error determining tier (using default):', tierError);
            }
            
            pawbucksEarned = Math.floor(stripeAmountForRewards * pawbucksMultiplier);
            
            console.log('[INVOICE_PAYMENT] Awarding PawBucks:', {
              userId: invoicePayerUserId,
              stripeAmountForRewards,
              pawbucksMultiplier,
              pawbucksEarned,
              tierName,
            });
            
            if (pawbucksEarned > 0) {
              // Get or create PawBucks wallet
              let { data: wallet } = await supabaseAdmin
                .from('pawbucks_wallet')
                .select('*')
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
                // Update wallet balance
                const { error: walletUpdateError } = await supabaseAdmin
                  .from('pawbucks_wallet')
                  .update({ balance: wallet.balance + pawbucksEarned })
                  .eq('user_id', invoicePayerUserId);

                if (walletUpdateError) {
                  console.error('[INVOICE_PAYMENT] Error updating PawBucks wallet:', walletUpdateError);
                } else {
                  console.log(`[INVOICE_PAYMENT] ✅ PawBucks wallet updated: +${pawbucksEarned} PawBucks`);
                }

                // Log PawBucks activity
                await supabaseAdmin
                  .from('pawbucks_activity')
                  .insert({
                    user_id: invoicePayerUserId,
                    type: 'earn',
                    amount: pawbucksEarned,
                    source: 'Invoice Payment',
                    partner_id: merchantId || null,
                    description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from $${stripeAmountForRewards.toFixed(2)} invoice payment`,
                  });

                console.log(`[INVOICE_PAYMENT] ✅ Awarded ${pawbucksEarned} PawBucks to user ${invoicePayerUserId}`);
              }
            }
          }
          
          // ========================================
          // CREATE TRANSACTION RECORD FOR INVOICE PAYMENT
          // ========================================
          // Fetch invoice and merchant details for transaction
          const { data: invoiceForTx } = await supabaseAdmin
            .from('invoices')
            .select('invoice_number, client_name')
            .eq('id', invoiceId)
            .single();
          
          const { data: merchantForTx } = await supabaseAdmin
            .from('merchants')
            .select('business_name')
            .eq('id', merchantId)
            .single();
          
          if (invoicePayerUserId && merchantId) {
            const pawbucksValueUSD = pawbucksUsed * 0.001;
            const totalTransactionAmount = paymentAmount + pawbucksValueUSD;
            const platformFee = paymentAmount * 0.025; // 2.5% fee only on Stripe portion
            
            const { data: transaction, error: transactionError } = await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: invoicePayerUserId,
                merchant_id: merchantId,
                amount: totalTransactionAmount,
                stripe_amount: paymentAmount,
                pawbucks_used: pawbucksUsed,
                application_fee: platformFee,
                cashback_earned: pawbucksEarned,
                rewards_earned: pawbucksEarned,
                description: `Invoice #${invoiceForTx?.invoice_number || 'Payment'}${tipAmount > 0 ? ` (includes $${(tipAmount / 100).toFixed(2)} tip)` : ''}`,
                status: 'completed',
                stripe_payment_intent_id: session.payment_intent as string || `invoice_${invoiceId}`,
              })
              .select()
              .single();

            if (transactionError) {
              console.error('[INVOICE_PAYMENT] ❌ Error creating transaction:', transactionError);
            } else {
              console.log('[INVOICE_PAYMENT] ✅ Transaction recorded:', transaction.id);
            }
          } else {
            console.log('[INVOICE_PAYMENT] Skipping transaction record - missing userId or merchantId:', {
              hasUserId: !!invoicePayerUserId,
              hasMerchantId: !!merchantId,
            });
          }
          
          // Send invoice-specific receipt email to customer (includes line items, payment history)
          await sendInvoiceReceiptEmail(invoiceId);
          
          // ========================================
          // SEND MERCHANT INVOICE PAID NOTIFICATION
          // ========================================
          try {
            // Fetch full invoice and merchant details for notification
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
              // Get merchant user email
              const { data: merchantProfile } = await supabaseAdmin
                .from('profiles')
                .select('email, full_name')
                .eq('id', merchantForNotif.user_id)
                .single();
              
              if (merchantProfile?.email) {
                const pawbucksValueUSD = pawbucksUsed * 0.001;
                await sendInvoicePaidNotification({
                  merchantEmail: merchantProfile.email,
                  merchantName: merchantProfile.full_name || merchantForNotif.business_name || 'Merchant',
                  invoiceNumber: invoiceForNotif?.invoice_number || 'N/A',
                  invoiceTitle: invoiceForNotif?.title || undefined,
                  clientName: invoiceForNotif?.client_name || session.customer_details?.name || 'Customer',
                  clientEmail: invoiceForNotif?.client_email || session.customer_email || '',
                  amountPaid: paymentAmount,
                  tipAmount: tipAmount > 0 ? tipAmount / 100 : 0,
                  pawbucksUsed: pawbucksUsed,
                  paymentMethod: pawbucksUsed > 0 ? 'mixed' : 'credit_card',
                  paymentDate: new Date().toISOString(),
                  invoiceTotal: invoiceForNotif?.total || paymentAmount,
                  amountDue: invoiceForNotif?.amount_due || 0,
                  invoiceId: invoiceId,
                });
              }
            }
          } catch (notifError) {
            console.error('[INVOICE_PAYMENT] Error sending merchant notification:', notifError);
            // Don't fail the payment processing due to notification error
          }
          
          console.log('[INVOICE_PAYMENT] ✅ Invoice payment processing complete');
        }
      }
    }

    // Handle successful invoice payment (renewal) - Award PawBucks for recurring payments
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;
      const amount = invoice.amount_paid / 100; // Convert from cents

      console.log('Invoice payment succeeded:', {
        invoiceId: invoice.id,
        subscriptionId,
        amount,
        billingReason: invoice.billing_reason,
      });

      // Only process subscription renewals (not initial subscription creation)
      // Initial subscription is handled by checkout.session.completed + payment_intent.succeeded
      const isRenewal = invoice.billing_reason === 'subscription_cycle' || 
                        invoice.billing_reason === 'subscription_update';

      if (subscriptionId && amount > 0) {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2024-12-18.acacia',
        });
        
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);

        // Update subscription record
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: subscription.status,
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          })
          .eq('stripe_subscription_id', subscriptionId);

        if (updateError) {
          console.error('Error updating subscription:', updateError);
        } else {
          console.log('✅ Subscription renewed');
        }

        // Log renewal event
        await supabaseAdmin
          .from('subscription_events')
          .insert({
            subscription_id: subscriptionId,
            event_type: 'invoice.payment_succeeded',
          });

        // Award PawBucks for recurring payments
        if (isRenewal) {
          console.log('Processing PawBucks for recurring subscription payment');
          
          // Get customer email from Stripe
          const customerId = invoice.customer as string;
          let customerEmail: string | null = null;
          let userId: string | null = null;
          let merchantId: string | null = null;

          try {
            const customer = await stripe.customers.retrieve(customerId);
            if (customer && !customer.deleted) {
              customerEmail = customer.email;
            }
          } catch (e) {
            console.error('Error fetching customer:', e);
          }

          // Look up user by email
          if (customerEmail) {
            const { data: profile } = await supabaseAdmin
              .from('profiles')
              .select('id')
              .eq('email', customerEmail)
              .maybeSingle();

            if (profile) {
              userId = profile.id;
            }
          }

          // Try to get merchant_id from subscription metadata
          if (subscription.metadata?.merchant_id) {
            merchantId = subscription.metadata.merchant_id;
          }

          if (userId && merchantId) {
            // Determine PawBucks multiplier based on subscription tier
            let pawbucksMultiplier = 10; // Default 10x for free accounts
            let tierName = 'Free';

            // Check user's platform subscription tier (PawPass/PawPass+)
            const { data: platformSub } = await supabaseAdmin
              .from('subscriptions')
              .select('stripe_subscription_id')
              .eq('user_id', userId)
              .in('status', ['active', 'trialing'])
              .maybeSingle();

            if (platformSub?.stripe_subscription_id) {
              try {
                const platformSubscription = await stripe.subscriptions.retrieve(platformSub.stripe_subscription_id);
                const productId = platformSubscription.items.data[0]?.price?.product;
                
                if (productId === 'prod_TQyZjYzt9DwoIK') {
                  pawbucksMultiplier = 30; // PawPass+
                  tierName = 'PawPass+';
                } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
                  pawbucksMultiplier = 20; // PawPass
                  tierName = 'PawPass';
                }
              } catch (e) {
                console.error('Error fetching platform subscription:', e);
              }
            }

            const pawbucksEarned = Math.floor(amount * pawbucksMultiplier);

            console.log('Recording recurring payment transaction:', {
              userId,
              merchantId,
              amount,
              pawbucksEarned,
              pawbucksMultiplier: `${pawbucksMultiplier}x`,
              tierName,
            });

            // Create transaction record for recurring payment
            const { data: transaction, error: transactionError } = await supabaseAdmin
              .from('transactions')
              .insert({
                user_id: userId,
                merchant_id: merchantId,
                amount: amount,
                cashback_earned: pawbucksEarned,
                rewards_earned: pawbucksEarned,
                description: `Recurring subscription payment`,
                status: 'completed',
                stripe_payment_intent_id: invoice.payment_intent as string || `invoice_${invoice.id}`,
              })
              .select()
              .single();

            if (transactionError) {
              console.error('Error creating recurring payment transaction:', transactionError);
            } else {
              console.log('✅ Recurring payment transaction recorded:', transaction.id);
              
              // Credit PawBucks to user's wallet
              let { data: wallet } = await supabaseAdmin
                .from('pawbucks_wallet')
                .select('*')
                .eq('user_id', userId)
                .single();

              if (!wallet) {
                // Create wallet if it doesn't exist
                const { data: newWallet } = await supabaseAdmin
                  .from('pawbucks_wallet')
                  .insert({ user_id: userId, balance: 0 })
                  .select()
                  .single();
                wallet = newWallet;
              }

              if (wallet) {
                // Update wallet balance
                const { error: walletUpdateError } = await supabaseAdmin
                  .from('pawbucks_wallet')
                  .update({ balance: wallet.balance + pawbucksEarned })
                  .eq('user_id', userId);

                if (walletUpdateError) {
                  console.error('Error updating PawBucks wallet:', walletUpdateError);
                } else {
                  console.log(`✅ PawBucks wallet updated: +${pawbucksEarned} PawBucks`);
                }

                // Log PawBucks activity
                const { error: activityError } = await supabaseAdmin
                  .from('pawbucks_activity')
                  .insert({
                    user_id: userId,
                    type: 'earn',
                    amount: pawbucksEarned,
                    source: 'Recurring Subscription',
                    transaction_id: transaction.id,
                    description: `Earned ${pawbucksEarned} PawBucks from recurring subscription payment (${tierName} tier - ${pawbucksMultiplier}x)`,
                  });

                if (activityError) {
                  console.error('Error logging PawBucks activity:', activityError);
                } else {
                  console.log('✅ PawBucks activity logged');
                }
              }

              console.log(`✅ User earned ${pawbucksEarned} PawBucks (${tierName} tier)`);
            }
          } else {
            console.log('Could not process PawBucks for recurring payment - missing user_id or merchant_id', {
              userId,
              merchantId,
              customerEmail,
            });
          }
        } else {
          console.log('Skipping PawBucks for initial subscription payment (handled by payment_intent.succeeded)');
        }
      }
    }

    // Handle subscription deletion
    if (event.type === 'customer.subscription.deleted') {
      const subscription = event.data.object as Stripe.Subscription;
      
      console.log('Subscription deleted:', {
        subscriptionId: subscription.id,
      });

      // Update subscription status to canceled
      const { error: updateError } = await supabaseAdmin
        .from('subscriptions')
        .update({
          status: 'canceled',
        })
        .eq('stripe_subscription_id', subscription.id);

      if (updateError) {
        console.error('Error canceling subscription:', updateError);
      } else {
        console.log('✅ Subscription canceled');
      }

      // Log cancellation event
      await supabaseAdmin
        .from('subscription_events')
        .insert({
          subscription_id: subscription.id,
          event_type: 'subscription.canceled',
        });
    }

    // Handle failed invoice payment
    if (event.type === 'invoice.payment_failed') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('Invoice payment failed:', {
        invoiceId: invoice.id,
        subscriptionId,
      });

      if (subscriptionId) {
        // Update subscription status to past_due
        const { error: updateError } = await supabaseAdmin
          .from('subscriptions')
          .update({
            status: 'past_due',
          })
          .eq('stripe_subscription_id', subscriptionId);

        if (updateError) {
          console.error('Error updating subscription to past_due:', updateError);
        } else {
          console.log('✅ Subscription marked as past_due');
        }

        // Log failed payment event
        await supabaseAdmin
          .from('subscription_events')
          .insert({
            subscription_id: subscriptionId,
            event_type: 'invoice.payment_failed',
          });
      }
    }

    // ========================================
    // PAYMENT WEBHOOK HANDLERS (existing)
    // ========================================

    // Handle successful payment
    if (event.type === 'payment_intent.succeeded') {
      const paymentIntent = event.data.object as Stripe.PaymentIntent;
      const metadata = paymentIntent.metadata || {};
      const { merchant_id, user_id, description } = metadata;

      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        merchant_id,
        user_id,
        metadataType: metadata.type,
      });

      // ========================================
      // EARLY SKIP: Invoice payments are handled by checkout.session.completed
      // This prevents race condition where both events process simultaneously
      // ========================================
      if (metadata.type === 'invoice_payment' || metadata.invoice_id) {
        console.log('[PAYMENT_INTENT] ⏭️ Skipping invoice payment - handled by checkout.session.completed');
        
        // Mark webhook as processed and return early
        await supabaseAdmin
          .from('webhook_logs')
          .update({ processed: true })
          .eq('event_id', event.id);
        
        console.log('Payment intent succeeded processed:', paymentIntent.id);
        return new Response(JSON.stringify({ received: true, skipped: 'invoice_payment_handled_by_checkout' }), { status: 200 });
      }

      // ========================================
      // DUPLICATE PREVENTION CHECK
      // Skip if this payment was already processed via checkout.session.completed
      // (e.g., subscription payments or other payment types)
      // ========================================
      const { data: existingTransaction } = await supabaseAdmin
        .from('transactions')
        .select('id')
        .eq('stripe_payment_intent_id', paymentIntent.id)
        .maybeSingle();

      if (existingTransaction) {
        console.log('[PAYMENT_INTENT] ⏭️ Skipping - transaction already exists for payment_intent:', paymentIntent.id);
        return new Response(JSON.stringify({ received: true, skipped: 'duplicate' }), { status: 200 });
      }

      const amount = paymentIntent.amount / 100; // Convert from cents
      
      // Determine PawBucks multiplier based on subscription tier
      // Free: 10x, PawPass: 20x, PawPass+: 30x
      let pawbucksMultiplier = 10; // Default 10x for free accounts
      let tierName = 'Free';
      
      if (user_id) {
        // Check user's subscription tier
        const { data: subscription } = await supabaseAdmin
          .from('subscriptions')
          .select('stripe_subscription_id')
          .eq('user_id', user_id)
          .in('status', ['active', 'trialing'])
          .maybeSingle();

        if (subscription?.stripe_subscription_id) {
          // Get subscription details from Stripe to check product
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          const productId = stripeSubscription.items.data[0]?.price?.product;
          
          console.log('User subscription found:', { productId });
          
          // Set multiplier based on product
          if (productId === 'prod_TQyZjYzt9DwoIK') {
            pawbucksMultiplier = 30; // PawPass+ gets 30x
            tierName = 'PawPass+';
            console.log('PawPass+ subscriber - 30x PawBucks');
          } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
            pawbucksMultiplier = 20; // PawPass gets 20x
            tierName = 'PawPass';
            console.log('PawPass subscriber - 20x PawBucks');
          }
        } else {
          console.log('Free account - 10x PawBucks');
        }
      }

      // Calculate PawBucks earned: amount × multiplier
      // $10 × 10 = 100 PawBucks for Free
      // $10 × 20 = 200 PawBucks for PawPass
      // $10 × 30 = 300 PawBucks for PawPass+
      const pawbucksEarned = Math.floor(amount * pawbucksMultiplier);

      console.log('Recording transaction:', {
        amount,
        pawbucksEarned,
        pawbucksMultiplier: `${pawbucksMultiplier}x`,
        tierName,
      });

      // Create transaction record (this will trigger wallet updates via database trigger)
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: user_id,
          merchant_id: merchant_id,
          amount: amount,
          cashback_earned: pawbucksEarned, // Store PawBucks earned
          rewards_earned: pawbucksEarned,
          description: description || 'Stripe payment',
          status: 'completed',
          stripe_payment_intent_id: paymentIntent.id,
        })
        .select()
        .single();

      if (transactionError) {
        console.error('Error creating transaction:', transactionError);
        throw transactionError;
      }

      console.log('✅ Transaction recorded successfully:', transaction.id);
      console.log('✅ Wallet updated via database trigger');
      console.log('✅ Wallet activity logged');

      // Auto-log network fee as Tax Vault expense
      if (merchant_id) {
        const platformFee = amount * 0.03; // 3% network fee
        if (platformFee > 0) {
          const expenseDate = new Date().toISOString().split('T')[0];
          const taxYear = new Date().getFullYear();

          const { error: expenseError } = await supabaseAdmin
            .from('merchant_tax_expenses')
            .insert({
              merchant_id: merchant_id,
              category: 'platform_fees',
              amount: platformFee,
              description: `PawBucks Network Fee (3%) on $${amount.toFixed(2)} sale`,
              vendor_name: 'PawBucks Network',
              expense_date: expenseDate,
              tax_year: taxYear,
              is_auto_logged: true,
              source_purchase_id: paymentIntent.id,
            });

          if (expenseError) {
            console.error('Error auto-logging network fee expense:', expenseError);
          } else {
            console.log(`✅ Network fee ($${platformFee.toFixed(2)}) auto-logged to Tax Vault`);
          }
        }
      }

      // ========================================
      // FUNDING DEALS REPAYMENT LOGIC
      // ========================================
      
      if (merchant_id) {
        // Check if merchant has an active funding deal
        const { data: activeDeal, error: dealError } = await supabaseAdmin
          .from('funding_deals')
          .select('*')
          .eq('merchant_id', merchant_id)
          .eq('status', 'active')
          .maybeSingle();

        if (dealError) {
          console.error('Error checking funding deal:', dealError);
        } else if (activeDeal) {
          console.log('Active funding deal found:', {
            dealId: activeDeal.id,
            amountFunded: activeDeal.amount_funded,
            totalRepaid: activeDeal.total_repaid,
            repaymentRate: activeDeal.repayment_rate,
          });

          // Calculate repayment amount (default 10% or use custom rate)
          const repaymentAmount = amount * (activeDeal.repayment_rate / 100);
          const newTotalRepaid = parseFloat(activeDeal.total_repaid) + repaymentAmount;
          
          // Check if deal is fully repaid
          const isFullyRepaid = newTotalRepaid >= parseFloat(activeDeal.amount_funded);
          const finalRepaymentAmount = isFullyRepaid 
            ? parseFloat(activeDeal.amount_funded) - parseFloat(activeDeal.total_repaid)
            : repaymentAmount;

          console.log('Repayment calculation:', {
            transactionAmount: amount,
            repaymentRate: activeDeal.repayment_rate,
            repaymentAmount: finalRepaymentAmount,
            newTotalRepaid: isFullyRepaid ? activeDeal.amount_funded : newTotalRepaid,
            isFullyRepaid,
          });

          // Update funding deal
          const { error: updateError } = await supabaseAdmin
            .from('funding_deals')
            .update({
              total_repaid: isFullyRepaid ? activeDeal.amount_funded : newTotalRepaid,
              status: isFullyRepaid ? 'paid_off' : 'active',
            })
            .eq('id', activeDeal.id);

          if (updateError) {
            console.error('Error updating funding deal:', updateError);
          } else {
            console.log('✅ Funding deal updated:', {
              dealId: activeDeal.id,
              repaymentAmount: finalRepaymentAmount,
              status: isFullyRepaid ? 'paid_off' : 'active',
            });

            // Log repayment in wallet_activity for merchant
            const { data: merchant, error: merchantError } = await supabaseAdmin
              .from('merchants')
              .select('user_id')
              .eq('id', merchant_id)
              .single();

            if (!merchantError && merchant) {
              // Get merchant's wallet
              const { data: merchantWallet, error: walletError } = await supabaseAdmin
                .from('wallets')
                .select('id, balance')
                .eq('user_id', merchant.user_id)
                .maybeSingle();

              if (!walletError && merchantWallet) {
                await supabaseAdmin
                  .from('wallet_activity')
                  .insert({
                    user_id: merchant.user_id,
                    wallet_id: merchantWallet.id,
                    transaction_id: transaction.id,
                    type: 'debit',
                    amount: finalRepaymentAmount,
                    balance_before: merchantWallet.balance,
                    balance_after: parseFloat(merchantWallet.balance) - finalRepaymentAmount,
                    description: `Funding repayment (${activeDeal.repayment_rate}% of transaction)${isFullyRepaid ? ' - Deal paid off!' : ''}`,
                  });
                
                console.log('✅ Repayment activity logged');
              }
            }
          }
        }
      }

      // Handle Pet Store purchases
      if (paymentIntent.metadata?.source === 'pet_store') {
        const { item_id, item_name, quantity, user_id } = paymentIntent.metadata;
        const totalAmount = paymentIntent.amount / 100;

        console.log('Pet Store purchase detected:', { item_id, item_name, quantity, totalAmount });

        // Create order
        const { data: order, error: orderError } = await supabaseAdmin
          .from('pet_store_orders')
          .insert([{
            user_id: user_id,
            total_amount: Math.round(totalAmount),
            status: 'completed',
          }])
          .select()
          .single();

        if (!orderError && order) {
          // Create order item
          await supabaseAdmin
            .from('pet_store_order_items')
            .insert([{
              order_id: order.id,
              item_id: item_id,
              quantity: parseInt(quantity),
              price_per_item: Math.round(totalAmount / parseInt(quantity)),
            }]);

          // Update stock
          const { data: item } = await supabaseAdmin
            .from('pet_store_items')
            .select('stock_quantity')
            .eq('id', item_id)
            .single();

          if (item) {
            await supabaseAdmin
              .from('pet_store_items')
              .update({ stock_quantity: item.stock_quantity - parseInt(quantity) })
              .eq('id', item_id);
          }

          console.log('✅ Pet Store order completed:', order.id);
        }
      }

      // Handle Merchant Market service purchases (USD payments)
      if (paymentIntent.metadata?.purchase_type === 'market_service') {
        const { service_id, service_name, total_price, billing_period } = paymentIntent.metadata;
        const totalAmount = paymentIntent.amount / 100;

        console.log('Merchant Market purchase detected:', { service_id, service_name, totalAmount });

        // Get FULL merchant details for Tax Vault entry AND admin notification email
        const { data: merchantForMarket } = await supabaseAdmin
          .from('merchants')
          .select('id, business_name, business_type, contact_person, email, phone, address, owner_name')
          .eq('user_id', user_id)
          .single();

        if (merchantForMarket) {
          // Normalize billing period (handle both snake_case and kebab-case, and yearly/annual)
          const normalizedPeriod = billing_period?.replace('_', '-').replace('yearly', 'annual');
          // Create the service purchase record
          const expiresAt = normalizedPeriod === 'monthly' 
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
            : normalizedPeriod === 'quarterly'
            ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
            : normalizedPeriod === 'annual'
            ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
            : null;

          const { data: purchaseData } = await supabaseAdmin.from('merchant_service_purchases').insert({
            merchant_id: merchantForMarket.id,
            service_id: service_id,
            amount_paid_pawbucks: 0,
            amount_paid_usd: totalAmount,
            status: 'active',
            expires_at: expiresAt,
            stripe_payment_intent_id: paymentIntent.id,
          }).select('id').single();

          // Auto-log expense to Tax Vault
          // USD payment = full price, no PawBucks discount savings
          await supabaseAdmin.from('merchant_tax_expenses').insert({
            merchant_id: merchantForMarket.id,
            category: 'merchant_market',
            amount: totalAmount,
            original_price: totalAmount,
            savings_amount: 0, // No savings for USD payments
            description: `${service_name || 'Merchant Market Service'} - USD Payment${billing_period ? ` (${billing_period})` : ''}`,
            vendor_name: 'PawBucks Merchant Market',
            expense_date: new Date().toISOString().split('T')[0],
            tax_year: new Date().getFullYear(),
            is_auto_logged: true,
            source_purchase_id: purchaseData?.id || service_id,
          });

          // Send admin notification email NOW that payment is complete
          try {
            const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
            const orderNumber = `MKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const purchaseDate = new Date().toLocaleString('en-US', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
              timeZoneName: 'short'
            });

            await resend.emails.send({
              from: "PawBucks <noreply@pawbucks.app>",
              to: ["admin@pawbucks.app"],
              subject: `Merchant Market Purchase Order #${orderNumber}: ${service_name || 'Service'}`,
              html: `
                <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0;">
                  <div style="background: linear-gradient(135deg, #7DD4D4, #5BC0C0); padding: 25px; text-align: center;">
                    <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 2px;">PAWBUCKS</h1>
                    <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">Merchant Market Purchase Order</p>
                  </div>
                  
                  <div style="padding: 30px; background: #ffffff;">
                    <div style="border-bottom: 2px solid #7DD4D4; padding-bottom: 15px; margin-bottom: 25px;">
                      <h2 style="color: #333; margin: 0; font-size: 20px;">Purchase Order #${orderNumber}</h2>
                      <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">${purchaseDate}</p>
                    </div>
                    
                    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
                      <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Merchant Information</h3>
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666; width: 140px;"><strong>Business Name:</strong></td><td style="padding: 8px 0; color: #333;">${merchantForMarket.business_name}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Business Type:</strong></td><td style="padding: 8px 0; color: #333;">${merchantForMarket.business_type || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Owner Name:</strong></td><td style="padding: 8px 0; color: #333;">${merchantForMarket.owner_name || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Contact Person:</strong></td><td style="padding: 8px 0; color: #333;">${merchantForMarket.contact_person || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Email:</strong></td><td style="padding: 8px 0; color: #333;"><a href="mailto:${merchantForMarket.email}" style="color: #7DD4D4;">${merchantForMarket.email || 'N/A'}</a></td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Phone:</strong></td><td style="padding: 8px 0; color: #333;">${merchantForMarket.phone || 'N/A'}</td></tr>
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Address:</strong></td><td style="padding: 8px 0; color: #333;">${merchantForMarket.address || 'N/A'}</td></tr>
                      </table>
                    </div>
                    
                    <div style="margin-bottom: 25px;">
                      <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Service Purchased</h3>
                      <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
                        <thead>
                          <tr style="background: #f8f9fa;">
                            <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7DD4D4; color: #333;">Service</th>
                            <th style="padding: 12px; text-align: center; border-bottom: 2px solid #7DD4D4; color: #333;">Billing Period</th>
                            <th style="padding: 12px; text-align: right; border-bottom: 2px solid #7DD4D4; color: #333;">Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr>
                            <td style="padding: 15px 12px; border-bottom: 1px solid #e0e0e0;"><strong style="color: #333;">${service_name || 'Merchant Market Service'}</strong><br><span style="color: #888; font-size: 12px;">ID: ${service_id}</span></td>
                            <td style="padding: 15px 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #666;">${billing_period || 'one-time'}</td>
                            <td style="padding: 15px 12px; text-align: right; border-bottom: 1px solid #e0e0e0;"><strong style="color: #333;">$${totalAmount.toFixed(2)} USD</strong></td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                    
                    <div style="background: #f0fafa; padding: 20px; border-radius: 8px; border-left: 4px solid #7DD4D4;">
                      <table style="width: 100%; border-collapse: collapse;">
                        <tr><td style="padding: 8px 0; color: #666;"><strong>Payment Method:</strong></td><td style="padding: 8px 0; text-align: right; color: #333;">Credit Card (Stripe)</td></tr>
                        <tr style="font-size: 18px;"><td style="padding: 12px 0 0 0; color: #333;"><strong>Total:</strong></td><td style="padding: 12px 0 0 0; text-align: right; color: #7DD4D4;"><strong>$${totalAmount.toFixed(2)} USD</strong></td></tr>
                      </table>
                    </div>
                  </div>
                  
                  <div style="background: #333; padding: 20px; text-align: center;">
                    <p style="color: #999; font-size: 12px; margin: 0;">PawBucks Admin Notification • Merchant Market Purchase</p>
                    <p style="color: #666; font-size: 11px; margin: 8px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
                  </div>
                </div>
              `,
            });

            console.log('✅ Merchant Market admin notification email sent:', orderNumber);
          } catch (emailError) {
            console.error('Warning: Failed to send admin notification email:', emailError);
            // Don't fail the webhook for email errors
          }

          console.log('✅ Merchant Market purchase completed and Tax Vault updated:', { 
            merchantId: merchantForMarket.id,
            serviceName: service_name,
            amount: totalAmount 
          });
        }
      }

      // Free: 10 PawBucks per $1, PawPass: 20 PawBucks per $1, PawPass+: 30 PawBucks per $1
      if (pawbucksEarned > 0 && user_id) {
        // Get or create PawBucks wallet
        let { data: wallet } = await supabaseAdmin
          .from('pawbucks_wallet')
          .select('*')
          .eq('user_id', user_id)
          .single();

        if (!wallet) {
          // Create wallet if it doesn't exist
          const { data: newWallet } = await supabaseAdmin
            .from('pawbucks_wallet')
            .insert({ user_id: user_id, balance: 0 })
            .select()
            .single();
          wallet = newWallet;
        }

        if (wallet) {
          // Update wallet balance
          await supabaseAdmin
            .from('pawbucks_wallet')
            .update({ balance: wallet.balance + pawbucksEarned })
            .eq('user_id', user_id);

          // Log PawBucks activity
          await supabaseAdmin
            .from('pawbucks_activity')
            .insert({
              user_id: user_id,
              type: 'earn',
              amount: pawbucksEarned,
              source: 'Transaction',
              transaction_id: transaction.id,
              partner_id: merchant_id,
              description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from $${amount.toFixed(2)} purchase`
            });

        console.log(`✅ Awarded ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) to user ${user_id}`);
        }
      }

      // Check budget thresholds and send notifications
      if (user_id && merchant_id) {
        try {
          // Get merchant category
          const { data: merchantData } = await supabaseAdmin
            .from('merchants')
            .select('business_type')
            .eq('id', merchant_id)
            .single();

          const budgetCheckPayload = {
            user_id,
            amount,
            merchant_category: merchantData?.business_type || 'other',
          };

          // Call budget check function
          const budgetCheckResponse = await fetch(
            `${Deno.env.get('SUPABASE_URL')}/functions/v1/check-budget-notify`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              },
              body: JSON.stringify(budgetCheckPayload),
            }
          );

          if (budgetCheckResponse.ok) {
            const budgetResult = await budgetCheckResponse.json();
            console.log('Budget check result:', budgetResult);
          } else {
            console.error('Budget check failed:', await budgetCheckResponse.text());
          }
        } catch (budgetError) {
          console.error('Error checking budget:', budgetError);
        }
      }

      // Send detailed receipt email for payment
      const customerEmail = paymentIntent.receipt_email;
      if (customerEmail && user_id && merchant_id) {
        // Get merchant details for email
        const { data: merchantInfo } = await supabaseAdmin
          .from('merchants')
          .select('business_name, address')
          .eq('id', merchant_id)
          .single();
        
        // Get user profile for name
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('id', user_id)
          .single();

        // Get payment method details from Stripe if available
        let cardBrand: string | undefined;
        let cardLast4: string | undefined;
        if (paymentIntent.payment_method) {
          try {
            const paymentMethod = await stripe.paymentMethods.retrieve(paymentIntent.payment_method as string);
            if (paymentMethod.card) {
              cardBrand = paymentMethod.card.brand?.charAt(0).toUpperCase() + paymentMethod.card.brand?.slice(1);
              cardLast4 = paymentMethod.card.last4;
            }
          } catch (pmError) {
            console.log('[PAYMENT] Could not retrieve payment method details:', pmError);
          }
        }

        // Calculate PawBucks applied (from metadata if available)
        const pawbucksApplied = parseFloat(paymentIntent.metadata?.pawbucks_usd_value || '0');
        const subtotal = amount + pawbucksApplied;

        // Build item name from description or metadata
        const itemName = paymentIntent.metadata?.item_name || 
                        paymentIntent.metadata?.product_name || 
                        description || 
                        'Purchase';

        await sendReceiptEmail({
          email: customerEmail,
          customerName: userProfile?.full_name || undefined,
          transactionDate: new Date(paymentIntent.created * 1000).toISOString(),
          receiptId: paymentIntent.id,
          merchantName: merchantInfo?.business_name || 'PawBucks Partner',
          merchantLocation: merchantInfo?.address || undefined,
          items: [{ name: itemName, price: subtotal }],
          subtotal: subtotal,
          pawbucksApplied: pawbucksApplied,
          cardAmount: amount,
          totalPaid: subtotal,
          cardBrand,
          cardLast4,
          pawbucksEarned,
        });
      } else if (user_id) {
        // Try to get email from profile if not in payment intent
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name, email')
          .eq('id', user_id)
          .single();

        if (userProfile?.email && merchant_id) {
          const { data: merchantInfo } = await supabaseAdmin
            .from('merchants')
            .select('business_name, address')
            .eq('id', merchant_id)
            .single();

          const pawbucksApplied = parseFloat(paymentIntent.metadata?.pawbucks_usd_value || '0');
          const subtotal = amount + pawbucksApplied;
          const itemName = paymentIntent.metadata?.item_name || description || 'Purchase';

          await sendReceiptEmail({
            email: userProfile.email,
            customerName: userProfile.full_name || undefined,
            transactionDate: new Date(paymentIntent.created * 1000).toISOString(),
            receiptId: paymentIntent.id,
            merchantName: merchantInfo?.business_name || 'PawBucks Partner',
            merchantLocation: merchantInfo?.address || undefined,
            items: [{ name: itemName, price: subtotal }],
            subtotal: subtotal,
            pawbucksApplied: pawbucksApplied,
            cardAmount: amount,
            totalPaid: subtotal,
            pawbucksEarned,
          });
        } else {
          console.log('[PAYMENT] No email found for receipt');
        }
      } else {
        console.log('[PAYMENT] No user_id found for receipt email');
      }

      console.log('Payment intent succeeded processed:', paymentIntent.id);
    }

    // Handle Connect account updates
    if (event.type === 'account.updated') {
      const account = event.data.object as Stripe.Account;
      
      console.log('Connect account updated:', {
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
      });

      // Update merchant status in database
      const { error: updateError } = await supabaseAdmin
        .from('merchants')
        .update({
          stripe_account_status: account.charges_enabled ? 'active' : 'pending',
        })
        .eq('stripe_account_id', account.id);

      if (updateError) {
        console.error('Error updating merchant status:', updateError);
      } else {
        console.log('✅ Merchant status updated');
      }
    }

    // Handle payout events (for merchant tracking)
    if (event.type === 'payout.paid' || event.type === 'payout.failed') {
      const payout = event.data.object as Stripe.Payout;
      
      console.log(`Payout ${event.type}:`, {
        payoutId: payout.id,
        amount: payout.amount / 100,
        destination: payout.destination,
      });

      // You can add additional logging or notifications here
    }

    // Mark webhook as processed
    await supabaseAdmin
      .from('webhook_logs')
      .update({ processed: true })
      .eq('event_id', event.id);

    return new Response(
      JSON.stringify({ received: true }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Webhook error:', errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
