import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { z } from "https://esm.sh/zod@3.22.4";
import { reverseTaxForRefund } from "../_shared/tax.ts";

const refundSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
  note: z.string().max(500).optional(),
  refundApplicationFee: z.boolean().optional().default(true),
  idempotencyKey: z.string().min(8).max(100),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function logStep(step: string, details?: Record<string, unknown>) {
  console.log(`[MERCHANT-REFUND] ${step}`, details ? JSON.stringify(details) : '');
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
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

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');
    logStep('User authenticated', { userId: user.id });

    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, stripe_account_id, business_name, user_id')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      return jsonResponse({ error: 'Merchant account not found' }, 404);
    }

    const body = await req.json();
    const validation = refundSchema.safeParse(body);
    if (!validation.success) {
      return jsonResponse({ error: validation.error.errors[0]?.message || 'Invalid input' }, 400);
    }
    const { transactionId, amount: requestedAmount, reason, note, refundApplicationFee, idempotencyKey } = validation.data;

    // Idempotency short-circuit: same key already processed → return prior result
    const { data: existingAttempt } = await supabaseAdmin
      .from('refund_attempts')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingAttempt) {
      logStep('Duplicate refund request — returning prior result', { attemptId: existingAttempt.id });
      return jsonResponse({
        success: true,
        duplicate: true,
        refund: {
          id: existingAttempt.stripe_refund_id || `internal_${transactionId}`,
          amount: Number(existingAttempt.refund_amount),
          status: existingAttempt.status,
          pawbucks_deducted: existingAttempt.pawbucks_earned_reversed,
          pawbucks_returned: existingAttempt.pawbucks_spent_returned,
        },
      });
    }

    // Load transaction
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('id, stripe_payment_intent_id, amount, status, user_id, rewards_earned, pawbucks_used, amount_refunded, pawbucks_refunded, merchant_id, description, tax_amount, tax_calculation_id')
      .eq('id', transactionId)
      .eq('merchant_id', merchant.id)
      .single();

    if (txError || !transaction) {
      return jsonResponse({ error: 'Transaction not found or does not belong to your account' }, 404);
    }
    logStep('Transaction loaded', { txId: transactionId, amount: transaction.amount, alreadyRefunded: transaction.amount_refunded });

    if (transaction.status === 'refunded') {
      return jsonResponse({ error: 'Transaction has already been fully refunded' }, 400);
    }
    if (transaction.status !== 'completed' && transaction.status !== 'partially_refunded') {
      return jsonResponse({ error: 'Only completed transactions can be refunded' }, 400);
    }

    const totalAmount = Number(transaction.amount);
    const alreadyRefunded = Number(transaction.amount_refunded || 0);
    const refundAmount = Number(requestedAmount ?? (totalAmount - alreadyRefunded));
    const remaining = totalAmount - alreadyRefunded;

    if (refundAmount <= 0 || refundAmount > remaining + 0.001) {
      return jsonResponse({ error: `Refund amount exceeds remaining refundable balance ($${remaining.toFixed(2)})` }, 400);
    }

    // Pro-rated PawBucks reversals
    const ratio = refundAmount / totalAmount;
    const totalEarned = transaction.rewards_earned || 0;
    const totalSpent = transaction.pawbucks_used || 0;
    const earnedAlreadyReversed = transaction.pawbucks_refunded || 0; // we reuse this column? No — that's spent. Track earned via activity sum.

    // Get earned PB already deducted from prior refunds for this tx
    const { data: priorEarnedDeductions } = await supabaseAdmin
      .from('pawbucks_activity')
      .select('amount')
      .eq('transaction_id', transactionId)
      .eq('source', 'refund')
      .eq('type', 'redeem');
    const earnedDeductedSoFar = (priorEarnedDeductions || []).reduce((s, r) => s + Math.abs(r.amount || 0), 0);
    const spentReturnedSoFar = transaction.pawbucks_refunded || 0;

    const isFinalRefund = Math.abs((alreadyRefunded + refundAmount) - totalAmount) < 0.01;
    const earnedToReverse = isFinalRefund
      ? Math.max(0, totalEarned - earnedDeductedSoFar)
      : Math.min(totalEarned - earnedDeductedSoFar, Math.round(totalEarned * ratio));
    const spentToReturn = isFinalRefund
      ? Math.max(0, totalSpent - spentReturnedSoFar)
      : Math.min(totalSpent - spentReturnedSoFar, Math.round(totalSpent * ratio));

    // Reserve idempotency row early (unique constraint prevents concurrent dupes)
    const { data: attemptRow, error: attemptError } = await supabaseAdmin
      .from('refund_attempts')
      .insert({
        idempotency_key: idempotencyKey,
        transaction_id: transactionId,
        merchant_id: merchant.id,
        initiated_by: user.id,
        refund_amount: refundAmount,
        pawbucks_earned_reversed: earnedToReverse,
        pawbucks_spent_returned: spentToReturn,
        reason: reason || 'requested_by_customer',
        note: note || null,
        status: 'processing',
      })
      .select()
      .single();

    if (attemptError) {
      // Race: another request inserted with the same key
      if (attemptError.code === '23505') {
        const { data: winner } = await supabaseAdmin
          .from('refund_attempts').select('*').eq('idempotency_key', idempotencyKey).maybeSingle();
        if (winner) {
          return jsonResponse({
            success: true,
            duplicate: true,
            refund: {
              id: winner.stripe_refund_id || `internal_${transactionId}`,
              amount: Number(winner.refund_amount),
              status: winner.status,
              pawbucks_deducted: winner.pawbucks_earned_reversed,
              pawbucks_returned: winner.pawbucks_spent_returned,
            },
          });
        }
      }
      return jsonResponse({ error: 'Failed to record refund attempt' }, 500);
    }

    // Stripe refund
    let stripeRefund: Stripe.Response<Stripe.Refund> | null = null;
    if (
      transaction.stripe_payment_intent_id &&
      !transaction.stripe_payment_intent_id.startsWith('checkout_') &&
      !transaction.stripe_payment_intent_id.startsWith('sub_')
    ) {
      const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' });
      const refundParams: Record<string, unknown> = {
        payment_intent: transaction.stripe_payment_intent_id,
        amount: Math.round(refundAmount * 100),
        reason: reason || 'requested_by_customer',
        reverse_transfer: true,
        refund_application_fee: refundApplicationFee !== false,
      };
      try {
        const opts: Stripe.RequestOptions = { idempotencyKey: `refund_${idempotencyKey}` };
        if (merchant.stripe_account_id) opts.stripeAccount = merchant.stripe_account_id;
        stripeRefund = await stripe.refunds.create(refundParams as Stripe.RefundCreateParams, opts);
        logStep('Stripe refund OK', { id: stripeRefund.id, status: stripeRefund.status });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Unknown';
        logStep('Stripe refund error', { msg });
        if (!msg.includes('already been refunded') && !msg.includes('No such payment_intent')) {
          await supabaseAdmin.from('refund_attempts').update({ status: 'failed' }).eq('id', attemptRow.id);
          return jsonResponse({ error: `Stripe refund failed: ${msg}` }, 400);
        }
      }
    }

    // Update transaction (partial vs full)
    const newAmountRefunded = alreadyRefunded + refundAmount;
    const newPbRefunded = spentReturnedSoFar + spentToReturn;
    const newStatus = isFinalRefund ? 'refunded' : 'partially_refunded';
    await supabaseAdmin
      .from('transactions')
      .update({ status: newStatus, amount_refunded: newAmountRefunded, pawbucks_refunded: newPbRefunded })
      .eq('id', transactionId);
    logStep('Transaction updated', { newStatus, newAmountRefunded });

    // ============================================================
    // SALES TAX REVERSAL — proportional to the refunded merchandise.
    // Tax is never recomputed here; the original calculation is the
    // source of truth and is preserved (tax_reversals is append-only).
    // ============================================================
    if (transaction.tax_calculation_id || transaction.stripe_payment_intent_id) {
      try {
        const taxCents = Math.round(Number(transaction.tax_amount || 0) * 100);
        const merchandiseTotalCents = Math.max(0, Math.round(totalAmount * 100) - taxCents);
        const refundRatio = totalAmount > 0 ? refundAmount / totalAmount : 0;
        const refundedTaxableCents = isFinalRefund
          ? merchandiseTotalCents
          : Math.round(merchandiseTotalCents * refundRatio);

        const reversal = await reverseTaxForRefund(
          new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', { apiVersion: '2023-10-16' }),
          supabaseAdmin,
          {
            taxCalculationId: transaction.tax_calculation_id ?? null,
            stripePaymentIntentId: transaction.stripe_payment_intent_id,
            refundedTaxableCents,
            full: isFinalRefund,
            stripeRefundId: stripeRefund?.id ?? null,
            reason: note || reason || 'requested_by_customer',
            createdBy: user.id,
          },
        );
        if (reversal) logStep('Tax reversed', { reversedTaxCents: reversal.reversedTaxCents });
      } catch (taxErr) {
        // Tax bookkeeping must never block a refund the customer is owed.
        logStep('Tax reversal failed (non-fatal)', { error: String(taxErr) });
      }
    }

    // Restore inventory for items decremented on the original sale (full refund only).
    if (isFinalRefund) {
      try {
        const { error: invErr } = await supabaseAdmin.rpc('restore_transaction_inventory', {
          p_transaction_id: transactionId,
        });
        if (invErr) logStep('Inventory restore failed (non-fatal)', { error: invErr.message });
      } catch (e) {
        logStep('Inventory restore exception (non-fatal)', { error: String(e) });
      }
    }

    // Auto-cancel linked subscription on full refund only
    if (isFinalRefund && transaction.stripe_payment_intent_id && transaction.user_id) {
      const { data: linkedSubs } = await supabaseAdmin
        .from('merchant_subscriptions').select('id')
        .eq('last_payment_intent_id', transaction.stripe_payment_intent_id)
        .eq('user_id', transaction.user_id)
        .in('status', ['active', 'past_due']);
      for (const sub of linkedSubs || []) {
        await supabaseAdmin.from('merchant_subscriptions')
          .update({ status: 'canceled', canceled_at: new Date().toISOString() }).eq('id', sub.id);
        await supabaseAdmin.from('merchant_subscription_events').insert({
          subscription_id: sub.id, event_type: 'canceled', amount: 0,
          metadata: { reason: 'payment_refunded', refunded_transaction_id: transactionId },
        });
      }
    }

    // Reverse earned PawBucks
    if (earnedToReverse > 0 && transaction.user_id) {
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: transaction.user_id,
        amount: -earnedToReverse,
        type: 'redeem',
        source: 'refund',
        description: `PawBucks reversed due to refund by ${merchant.business_name}`,
        transaction_id: transactionId,
        pawbucks_status: 'available',
      });
      const { data: wallet } = await supabaseAdmin
        .from('pawbucks_wallet').select('balance').eq('user_id', transaction.user_id).single();
      if (wallet) {
        await supabaseAdmin.from('pawbucks_wallet')
          .update({ balance: Math.max(0, wallet.balance - earnedToReverse) })
          .eq('user_id', transaction.user_id);
      }
    }

    // Return spent PawBucks back to wallet
    if (spentToReturn > 0 && transaction.user_id) {
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: transaction.user_id,
        amount: spentToReturn,
        type: 'earn',
        source: 'refund',
        description: `PawBucks returned from refund by ${merchant.business_name}`,
        transaction_id: transactionId,
        pawbucks_status: 'available',
      });
      const { data: wallet } = await supabaseAdmin
        .from('pawbucks_wallet').select('balance').eq('user_id', transaction.user_id).single();
      if (wallet) {
        await supabaseAdmin.from('pawbucks_wallet')
          .update({ balance: wallet.balance + spentToReturn })
          .eq('user_id', transaction.user_id);
      }
    }

    // Notify customer (in-app)
    if (transaction.user_id) {
      const pbNoteParts: string[] = [];
      if (earnedToReverse > 0) pbNoteParts.push(`${earnedToReverse} earned PawBucks were reversed`);
      if (spentToReturn > 0) pbNoteParts.push(`${spentToReturn} spent PawBucks were returned to your wallet`);
      const pbNote = pbNoteParts.length ? ` ${pbNoteParts.join(' and ')}.` : '';
      await supabaseAdmin.from('notifications').insert({
        user_id: transaction.user_id,
        title: isFinalRefund ? '💸 Refund Issued' : '💸 Partial Refund Issued',
        message: `${merchant.business_name} issued a $${refundAmount.toFixed(2)} refund.${pbNote}`,
        category: 'transactional',
      });
    }

    // Notify merchant (in-app confirmation)
    await supabaseAdmin.from('notifications').insert({
      user_id: merchant.user_id,
      title: isFinalRefund ? 'Refund processed' : 'Partial refund processed',
      message: `You issued a $${refundAmount.toFixed(2)} refund on transaction ${transactionId.slice(0, 8)}.`,
      category: 'transactional',
    });

    // Customer email
    if (transaction.user_id) {
      try {
        const { data: profile } = await supabaseAdmin
          .from('profiles').select('email, full_name').eq('id', transaction.user_id).single();
        if (profile?.email) {
          await supabaseAdmin.functions.invoke('send-refund-email', {
            headers: { 'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '' },
            body: {
              email: profile.email,
              customerName: profile.full_name,
              merchantName: merchant.business_name,
              refundAmount,
              isFullRefund: isFinalRefund,
              originalAmount: totalAmount,
              earnedReversed: earnedToReverse,
              spentReturned: spentToReturn,
              transactionId,
              reason: reason || 'requested_by_customer',
            },
          });
        }
      } catch (e) {
        logStep('Customer email failed (non-fatal)', { error: String(e) });
      }
    }

    // Mark attempt succeeded
    await supabaseAdmin
      .from('refund_attempts')
      .update({ status: 'succeeded', stripe_refund_id: stripeRefund?.id || null })
      .eq('id', attemptRow.id);

    // Audit log
    await supabaseAdmin.from('audit_logs').insert({
      admin_id: user.id,
      action: 'merchant_refund_issued',
      entity_type: 'transaction',
      entity_id: transactionId,
      changes: {
        refund_amount: refundAmount,
        partial: !isFinalRefund,
        reason: reason || 'requested_by_customer',
        note: note || null,
        refund_application_fee: refundApplicationFee !== false,
        stripe_refund_id: stripeRefund?.id || null,
        pawbucks_earned_reversed: earnedToReverse,
        pawbucks_spent_returned: spentToReturn,
        merchant_id: merchant.id,
        idempotency_key: idempotencyKey,
      },
    });

    return jsonResponse({
      success: true,
      refund: {
        id: stripeRefund?.id || `internal_${transactionId}`,
        amount: refundAmount,
        status: stripeRefund?.status || 'succeeded',
        partial: !isFinalRefund,
        pawbucks_deducted: earnedToReverse,
        pawbucks_returned: spentToReturn,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    logStep('Error', { msg });
    return jsonResponse({ error: msg }, 400);
  }
});