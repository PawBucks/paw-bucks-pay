import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, stripe-signature',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    const signature = req.headers.get('stripe-signature');
    const body = await req.text();

    // SECURITY: Verify webhook signature - MANDATORY
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
    
    if (!webhookSecret) {
      console.error('STRIPE_WEBHOOK_SECRET not configured');
      return new Response(
        JSON.stringify({ error: 'Webhook configuration error' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    let event;
    try {
      event = stripe.webhooks.constructEvent(body, signature!, webhookSecret);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      console.error('Webhook signature verification failed:', errorMessage);
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
      
      if (session.mode === 'subscription') {
        const userId = session.metadata?.user_id;
        const subscriptionId = session.subscription as string;
        
        console.log('Checkout session completed:', {
          sessionId: session.id,
          userId,
          subscriptionId,
        });

        if (userId && subscriptionId) {
          // Fetch subscription details
          const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
            apiVersion: '2025-08-27.basil',
          });
          
          const subscription = await stripe.subscriptions.retrieve(subscriptionId);
          
          // Create subscription record
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
            console.error('Error creating subscription record:', subError);
          } else {
            console.log('✅ Subscription record created');
          }

          // Log subscription event
          const { error: eventError } = await supabaseAdmin
            .from('subscription_events')
            .insert({
              subscription_id: subscriptionId,
              event_type: 'subscription.created',
            });

          if (eventError) {
            console.error('Error logging subscription event:', eventError);
          }
        }
      }
    }

    // Handle successful invoice payment (renewal)
    if (event.type === 'invoice.payment_succeeded') {
      const invoice = event.data.object as Stripe.Invoice;
      const subscriptionId = invoice.subscription as string;

      console.log('Invoice payment succeeded:', {
        invoiceId: invoice.id,
        subscriptionId,
        amount: invoice.amount_paid / 100,
      });

      if (subscriptionId) {
        // Fetch subscription to get current period end
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
      const { merchant_id, user_id, description, cashback_amount, cashback_rate } = paymentIntent.metadata;

      console.log('Payment succeeded:', {
        paymentIntentId: paymentIntent.id,
        amount: paymentIntent.amount / 100,
        merchant_id,
        user_id,
        cashback_amount,
      });

      const amount = paymentIntent.amount / 100; // Convert from cents
      const cashback = parseFloat(cashback_amount || '0');
      const rewardsEarned = Math.floor(amount); // 1 point per dollar

      console.log('Recording transaction:', {
        amount,
        cashback,
        rewardsEarned,
        rate: cashback_rate,
      });

      // Create transaction record (this will trigger wallet updates via database trigger)
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('transactions')
        .insert({
          user_id: user_id,
          merchant_id: merchant_id,
          amount: amount,
          cashback_earned: cashback,
          rewards_earned: rewardsEarned,
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

      // Award PawBucks coins
      let coinsEarned = 0;
      
      // Check if this is a direct PawBucks purchase (from checkout session)
      if (paymentIntent.metadata?.purchase_type === "pawbucks_direct" && paymentIntent.metadata?.coins_purchased) {
        coinsEarned = parseInt(paymentIntent.metadata.coins_purchased);
        console.log("Direct PawBucks purchase detected:", { coinsEarned });
      } else {
        // Regular transaction: Award PawBucks based on cashback
        const cashbackAmount = parseFloat(paymentIntent.metadata?.cashback_amount || '0');
        coinsEarned = Math.floor(cashbackAmount * 10); // Convert dollars to PawBucks (10 PawBucks = $1)
      }
      
      if (coinsEarned > 0 && user_id) {
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
            .update({ balance: wallet.balance + coinsEarned })
            .eq('user_id', user_id);

          // Log PawBucks activity
          await supabaseAdmin
            .from('pawbucks_activity')
            .insert({
              user_id: user_id,
              type: 'earn',
              amount: coinsEarned,
              source: 'Transaction',
              transaction_id: transaction.id,
              partner_id: merchant_id,
              description: `Earned ${coinsEarned} PawBucks from purchase`
            });

          console.log(`Awarded ${coinsEarned} PawBucks coins to user ${user_id} for transaction ${transaction.id}`);
        }
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
