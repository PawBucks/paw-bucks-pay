import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { z } from "https://esm.sh/zod@3.22.4";

const refundSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  note: z.string().max(500).optional(),
  refundApplicationFee: z.boolean().optional().default(true),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[MERCHANT-REFUND] ${step}`, details ? JSON.stringify(details) : '');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    logStep('User authenticated', { userId: user.id });

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, stripe_account_id, business_name, user_id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(
        JSON.stringify({ error: 'Merchant account not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    logStep('Merchant found', { merchantId: merchant.id, hasStripeAccount: !!merchant.stripe_account_id });

    // Parse and validate input
    const body = await req.json();
    const validation = refundSchema.safeParse(body);
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message || 'Invalid input' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { transactionId, amount: requestedAmount, reason, note, refundApplicationFee } = validation.data;

    // Get the transaction - verify it belongs to this merchant
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, stripe_payment_intent_id, amount, status, user_id, rewards_earned, merchant_id')
      .eq('id', transactionId)
      .eq('merchant_id', merchant.id)
      .single();

    if (txError || !transaction) {
      return new Response(
        JSON.stringify({ error: 'Transaction not found or does not belong to your account' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    logStep('Transaction found', { transactionId, status: transaction.status, amount: transaction.amount });

    if (transaction.status === 'refunded') {
      return new Response(
        JSON.stringify({ error: 'Transaction has already been refunded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    if (transaction.status !== 'completed') {
      return new Response(
        JSON.stringify({ error: 'Only completed transactions can be refunded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let stripeRefund = null;
    const refundAmount = requestedAmount || transaction.amount;

    // Attempt Stripe refund if there's a valid payment intent
    if (
      transaction.stripe_payment_intent_id &&
      !transaction.stripe_payment_intent_id.startsWith('checkout_') &&
      !transaction.stripe_payment_intent_id.startsWith('sub_')
    ) {
      logStep('Attempting Stripe refund', { paymentIntentId: transaction.stripe_payment_intent_id });

      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
        apiVersion: '2023-10-16',
      });

      const refundAmountCents = Math.round(refundAmount * 100);

      try {
        // For Direct Charges, refunds are issued on the connected account
        const refundParams: Record<string, unknown> = {
          payment_intent: transaction.stripe_payment_intent_id,
          amount: refundAmountCents,
          reason: reason || 'requested_by_customer',
          reverse_transfer: true,
          refund_application_fee: refundApplicationFee !== false,
        };

        if (merchant.stripe_account_id) {
          // Direct Charge refund: issue on connected account
          stripeRefund = await stripe.refunds.create(
            refundParams as Stripe.RefundCreateParams,
            { stripeAccount: merchant.stripe_account_id }
          );
        } else {
          // Platform charge refund (fallback)
          stripeRefund = await stripe.refunds.create(refundParams as Stripe.RefundCreateParams);
        }

        logStep('Stripe refund created', { refundId: stripeRefund.id, status: stripeRefund.status });
      } catch (stripeError: unknown) {
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
        logStep('Stripe refund error', { error: errorMessage });

        // Allow processing if already refunded in Stripe
        if (!errorMessage.includes('already been refunded') && !errorMessage.includes('No such payment_intent')) {
          return new Response(
            JSON.stringify({ error: `Stripe refund failed: ${errorMessage}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        logStep('Continuing with database updates despite Stripe error');
      }
    } else {
      logStep('No valid Stripe payment intent, processing as internal refund');
    }

    // Update transaction status
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'refunded' })
      .eq('id', transactionId);

    if (updateError) {
      logStep('Failed to update transaction status', { error: updateError });
    } else {
      logStep('Transaction status updated to refunded');
    }

    // Auto-cancel any merchant subscription linked to this refunded payment
    if (transaction.stripe_payment_intent_id && transaction.user_id) {
      const { data: linkedSubs, error: subError } = await supabaseAdmin
        .from('merchant_subscriptions')
        .select('id')
        .eq('last_payment_intent_id', transaction.stripe_payment_intent_id)
        .eq('user_id', transaction.user_id)
        .in('status', ['active', 'past_due']);
      
      if (!subError && linkedSubs && linkedSubs.length > 0) {
        for (const sub of linkedSubs) {
          await supabaseAdmin
            .from('merchant_subscriptions')
            .update({ status: 'canceled', canceled_at: new Date().toISOString() })
            .eq('id', sub.id);
          
          await supabaseAdmin
            .from('merchant_subscription_events')
            .insert({
              subscription_id: sub.id,
              event_type: 'canceled',
              amount: 0,
              metadata: { reason: 'payment_refunded', refunded_transaction_id: transactionId },
            });
          
          logStep('Auto-canceled linked subscription', { subId: sub.id });
        }
      }
    }

    // Deduct PawBucks earned from this transaction
    const pawbucksEarned = transaction.rewards_earned || 0;
    if (pawbucksEarned > 0 && transaction.user_id) {
      logStep('Deducting PawBucks', { amount: pawbucksEarned, userId: transaction.user_id });

      const { error: pawbucksError } = await supabaseAdmin
        .from('pawbucks_activity')
        .insert({
          user_id: transaction.user_id,
          amount: -pawbucksEarned,
          type: 'redeem',
          source: 'refund',
          description: `PawBucks deducted due to refund by ${merchant.business_name}`,
          transaction_id: transactionId,
          pawbucks_status: 'available',
        });

      if (pawbucksError) {
        logStep('Failed to deduct PawBucks', { error: pawbucksError });
      } else {
        logStep('PawBucks deducted successfully');

        // Update wallet balance
        const { data: wallet } = await supabaseAdmin
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', transaction.user_id)
          .single();

        if (wallet) {
          await supabaseAdmin
            .from('pawbucks_wallet')
            .update({ balance: Math.max(0, wallet.balance - pawbucksEarned) })
            .eq('user_id', transaction.user_id);
          logStep('Wallet balance updated', { previousBalance: wallet.balance, deducted: pawbucksEarned });
        }
      }
    }

    // Notify the user about the refund
    if (transaction.user_id) {
      try {
        await supabaseAdmin.from('notifications').insert({
          user_id: transaction.user_id,
          title: '💸 Refund Issued',
          message: `${merchant.business_name} has issued a $${refundAmount.toFixed(2)} refund.${pawbucksEarned > 0 ? ` ${pawbucksEarned} PawBucks were also adjusted.` : ''}`,
          category: 'transactional',
        });
        logStep('User notification created');
      } catch (notifError) {
        logStep('Failed to create user notification', { error: String(notifError) });
      }
    }

    // Log the merchant action in audit_logs
    try {
      await supabaseAdmin.from('audit_logs').insert({
        admin_id: user.id,
        action: 'merchant_refund_issued',
        entity_type: 'transaction',
        entity_id: transactionId,
        changes: {
          refund_amount: refundAmount,
          reason: reason || 'requested_by_customer',
          note: note || null,
          refund_application_fee: refundApplicationFee !== false,
          stripe_refund_id: stripeRefund?.id || null,
          pawbucks_deducted: pawbucksEarned,
          merchant_id: merchant.id,
        },
      });
      logStep('Audit log created');
    } catch (logError) {
      logStep('Failed to create audit log', { error: String(logError) });
    }

    logStep('Refund completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        refund: {
          id: stripeRefund?.id || `internal_${transactionId}`,
          amount: refundAmount,
          status: stripeRefund?.status || 'succeeded',
          pawbucks_deducted: pawbucksEarned,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error', { error: errorMessage });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
