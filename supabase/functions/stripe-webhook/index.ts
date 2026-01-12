import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

// Helper function to send payment confirmation email
async function sendPaymentConfirmationEmail(params: {
  email: string;
  customerName?: string;
  amount: number;
  merchantName: string;
  pawbucksEarned: number;
  orderReference: string;
  isSubscription?: boolean;
}): Promise<void> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    console.log("[EMAIL] Skipping confirmation email: RESEND_API_KEY not configured");
    return;
  }

  const resend = new Resend(resendApiKey);
  const { email, customerName, amount, merchantName, pawbucksEarned, orderReference, isSubscription } = params;

  const greeting = customerName ? `Hi ${customerName}` : "Hi there";
  const paymentType = isSubscription ? "subscription" : "purchase";

  try {
    const emailResponse = await resend.emails.send({
      from: "PawBucks <noreply@resend.dev>",
      to: [email],
      subject: `Payment Confirmed - ${merchantName}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
          <div style="max-width: 600px; margin: 0 auto; padding: 40px 20px;">
            <div style="background: white; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
              <!-- Header -->
              <div style="background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); padding: 32px; text-align: center;">
                <h1 style="margin: 0; color: white; font-size: 28px; font-weight: 700;">Payment Confirmed! 🎉</h1>
              </div>
              
              <!-- Content -->
              <div style="padding: 32px;">
                <p style="font-size: 16px; color: #333; margin: 0 0 24px 0;">${greeting},</p>
                
                <p style="font-size: 16px; color: #333; margin: 0 0 24px 0;">
                  Your ${paymentType} at <strong>${merchantName}</strong> has been successfully processed!
                </p>
                
                <!-- Order Summary -->
                <div style="background: #f9fafb; border-radius: 12px; padding: 24px; margin-bottom: 24px;">
                  <h3 style="margin: 0 0 16px 0; color: #333; font-size: 18px;">Order Summary</h3>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #666;">Amount Paid</span>
                    <strong style="color: #333;">$${amount.toFixed(2)}</strong>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between; margin-bottom: 12px;">
                    <span style="color: #666;">Merchant</span>
                    <strong style="color: #333;">${merchantName}</strong>
                  </div>
                  
                  <div style="display: flex; justify-content: space-between;">
                    <span style="color: #666;">Order Reference</span>
                    <strong style="color: #333; font-size: 12px;">${orderReference.substring(0, 20)}...</strong>
                  </div>
                </div>
                
                <!-- PawBucks Earned -->
                ${pawbucksEarned > 0 ? `
                <div style="background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%); border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
                  <p style="margin: 0 0 8px 0; color: #92400e; font-size: 14px;">🐾 You Earned</p>
                  <p style="margin: 0; color: #92400e; font-size: 32px; font-weight: 700;">${pawbucksEarned} PawBucks</p>
                  <p style="margin: 8px 0 0 0; color: #a16207; font-size: 14px;">Added to your wallet!</p>
                </div>
                ` : ''}
                
                <p style="font-size: 14px; color: #666; margin: 0 0 24px 0;">
                  Thank you for being a valued member of the PawBucks community. Your rewards are waiting for you!
                </p>
                
                <!-- CTA Button -->
                <div style="text-align: center;">
                  <a href="https://pawbucks.app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%); color: white; text-decoration: none; padding: 14px 32px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                    View Your Dashboard
                  </a>
                </div>
              </div>
              
              <!-- Footer -->
              <div style="background: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #e5e7eb;">
                <p style="margin: 0 0 8px 0; color: #999; font-size: 12px;">
                  Questions? Reply to this email or contact support@pawbucks.app
                </p>
                <p style="margin: 0; color: #999; font-size: 12px;">
                  © ${new Date().getFullYear()} PawBucks. All rights reserved.
                </p>
              </div>
            </div>
          </div>
        </body>
        </html>
      `,
    });

    if (emailResponse.error) {
      console.error("[EMAIL] Failed to send confirmation email:", emailResponse.error);
    } else {
      console.log(`[EMAIL] ✅ Confirmation email sent to ${email}`);
    }
  } catch (error) {
    console.error("[EMAIL] Error sending confirmation email:", error);
    // Don't throw - email failure shouldn't break the payment processing
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
      apiVersion: '2025-08-27.basil',
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
              apiVersion: '2025-08-27.basil',
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
                apiVersion: '2025-08-27.basil',
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
          apiVersion: '2025-08-27.basil',
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
      const { merchant_id, user_id, description } = paymentIntent.metadata;

      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        merchant_id,
        user_id,
      });

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

      // Award PawBucks based on multiplier (already calculated above)
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

      // Send confirmation email for payment
      const customerEmail = paymentIntent.receipt_email;
      if (customerEmail && user_id && merchant_id) {
        // Get merchant name for email
        const { data: merchantInfo } = await supabaseAdmin
          .from('merchants')
          .select('business_name')
          .eq('id', merchant_id)
          .single();
        
        // Get user profile for name
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('full_name')
          .eq('id', user_id)
          .single();

        await sendPaymentConfirmationEmail({
          email: customerEmail,
          customerName: userProfile?.full_name || undefined,
          amount,
          merchantName: merchantInfo?.business_name || description || 'PawBucks Partner',
          pawbucksEarned,
          orderReference: paymentIntent.id,
          isSubscription: false,
        });
      } else {
        console.log('[PAYMENT] No receipt email found for confirmation email');
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
