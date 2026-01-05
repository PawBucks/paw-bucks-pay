import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { z } from "https://esm.sh/zod@3.22.4";

const refundSchema = z.object({
  transactionId: z.string().uuid(),
  amount: z.number().positive().optional(),
  reason: z.enum(['duplicate', 'fraudulent', 'requested_by_customer']).optional(),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[REFUND] Starting refund process...');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('[REFUND] No authorization header');
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      console.error('[REFUND] User not authenticated:', userError);
      throw new Error('User not authenticated');
    }

    console.log('[REFUND] User authenticated:', user.id);

    // Check if user is admin or superadmin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: userRoles } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin']);

    if (!userRoles || userRoles.length === 0) {
      console.error('[REFUND] User is not admin or superadmin');
      return new Response(
        JSON.stringify({ error: 'Unauthorized: Admin access required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    console.log('[REFUND] User has admin/superadmin role');

    const requestBody = await req.json();
    console.log('[REFUND] Request body:', JSON.stringify(requestBody));
    
    const validationResult = refundSchema.safeParse(requestBody);

    if (!validationResult.success) {
      console.error('[REFUND] Validation error:', validationResult.error);
      return new Response(
        JSON.stringify({ error: validationResult.error.errors[0]?.message || 'Invalid input' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { transactionId, amount, reason } = validationResult.data;
    console.log('[REFUND] Processing refund for transaction:', transactionId);

    // Get full transaction details including user_id, rewards_earned, and merchant_id
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .select('stripe_payment_intent_id, amount, status, user_id, rewards_earned, merchant_id, pawbucks_used')
      .eq('id', transactionId)
      .single();

    if (txError || !transaction) {
      console.error('[REFUND] Transaction not found:', txError);
      return new Response(
        JSON.stringify({ error: 'Transaction not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('[REFUND] Transaction found:', JSON.stringify(transaction));

    if (transaction.status === 'refunded') {
      console.error('[REFUND] Transaction already refunded');
      return new Response(
        JSON.stringify({ error: 'Transaction has already been refunded' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    let stripeRefund = null;
    const refundAmount = amount || transaction.amount;

    // Only attempt Stripe refund if there's a valid payment intent
    if (transaction.stripe_payment_intent_id && 
        !transaction.stripe_payment_intent_id.startsWith('checkout_') &&
        !transaction.stripe_payment_intent_id.startsWith('sub_')) {
      console.log('[REFUND] Attempting Stripe refund for payment intent:', transaction.stripe_payment_intent_id);
      
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2023-10-16',
        });

        const refundAmountCents = Math.round(refundAmount * 100);
        
        stripeRefund = await stripe.refunds.create({
          payment_intent: transaction.stripe_payment_intent_id,
          amount: refundAmountCents,
          reason: reason || 'requested_by_customer',
        });

        console.log('[REFUND] Stripe refund created:', stripeRefund.id);
      } catch (stripeError: unknown) {
        console.error('[REFUND] Stripe refund failed:', stripeError);
        // If Stripe refund fails, we still process the database updates
        // This handles cases where the charge may have already been refunded or doesn't exist
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown Stripe error';
        
        // If it's a critical error (not just "already refunded"), return error
        if (!errorMessage.includes('already been refunded') && !errorMessage.includes('No such payment_intent')) {
          return new Response(
            JSON.stringify({ error: `Stripe refund failed: ${errorMessage}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
        console.log('[REFUND] Continuing with database updates despite Stripe error');
      }
    } else {
      console.log('[REFUND] No valid Stripe payment intent, processing as internal refund only');
    }

    // Update transaction status to refunded
    const { error: updateError } = await supabaseAdmin
      .from('transactions')
      .update({ status: 'refunded' })
      .eq('id', transactionId);

    if (updateError) {
      console.error('[REFUND] Failed to update transaction status:', updateError);
    } else {
      console.log('[REFUND] Transaction status updated to refunded');
    }

    // Deduct PawBucks from user if they earned any from this transaction
    const pawbucksEarned = transaction.rewards_earned || 0;
    if (pawbucksEarned > 0 && transaction.user_id) {
      console.log('[REFUND] Deducting', pawbucksEarned, 'PawBucks from user:', transaction.user_id);
      
      // Create a debit entry in pawbucks_activity
      const { error: pawbucksError } = await supabaseAdmin
        .from('pawbucks_activity')
        .insert({
          user_id: transaction.user_id,
          amount: -pawbucksEarned,
          type: 'debit',
          source: 'refund',
          description: `PawBucks deducted due to refund of transaction`,
          transaction_id: transactionId,
          pawbucks_status: 'available',
        });

      if (pawbucksError) {
        console.error('[REFUND] Failed to deduct user PawBucks:', pawbucksError);
      } else {
        console.log('[REFUND] User PawBucks deducted successfully');
      }
    }

    // If PawBucks were used in the transaction, refund them back to the user
    const pawbucksUsed = transaction.pawbucks_used || 0;
    if (pawbucksUsed > 0 && transaction.user_id) {
      console.log('[REFUND] Refunding', pawbucksUsed, 'PawBucks back to user:', transaction.user_id);
      
      const { error: refundPawbucksError } = await supabaseAdmin
        .from('pawbucks_activity')
        .insert({
          user_id: transaction.user_id,
          amount: pawbucksUsed,
          type: 'credit',
          source: 'refund',
          description: `PawBucks refunded from cancelled transaction`,
          transaction_id: transactionId,
          pawbucks_status: 'available',
        });

      if (refundPawbucksError) {
        console.error('[REFUND] Failed to refund user PawBucks:', refundPawbucksError);
      } else {
        console.log('[REFUND] User PawBucks refunded successfully');
      }
    }

    // Deduct PawBucks from merchant if they received any
    if (pawbucksUsed > 0 && transaction.merchant_id) {
      console.log('[REFUND] Deducting', pawbucksUsed, 'PawBucks from merchant:', transaction.merchant_id);
      
      // Deduct from merchant_pawbucks_wallet
      const { error: merchantWalletError } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .update({ 
          balance: supabaseAdmin.rpc('decrement_merchant_balance', { 
            merchant_id_input: transaction.merchant_id, 
            amount_input: pawbucksUsed 
          })
        })
        .eq('merchant_id', transaction.merchant_id);

      // Use direct SQL update instead since RPC might not exist
      const { error: walletUpdateError } = await supabaseAdmin
        .rpc('raw_sql', { 
          query: `UPDATE merchant_pawbucks_wallet SET balance = balance - ${pawbucksUsed} WHERE merchant_id = '${transaction.merchant_id}'` 
        });

      // Simpler approach: just update directly
      const { data: currentWallet } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', transaction.merchant_id)
        .single();

      if (currentWallet) {
        const newBalance = Math.max(0, (currentWallet.balance || 0) - pawbucksUsed);
        const { error: balanceUpdateError } = await supabaseAdmin
          .from('merchant_pawbucks_wallet')
          .update({ balance: newBalance })
          .eq('merchant_id', transaction.merchant_id);

        if (balanceUpdateError) {
          console.error('[REFUND] Failed to update merchant wallet balance:', balanceUpdateError);
        } else {
          console.log('[REFUND] Merchant wallet balance updated to:', newBalance);
        }
      }

      // Log the merchant activity
      const { error: merchantActivityError } = await supabaseAdmin
        .from('merchant_pawbucks_activity')
        .insert({
          merchant_id: transaction.merchant_id,
          amount: -pawbucksUsed,
          type: 'debit',
          source: 'refund',
          description: `PawBucks deducted due to transaction refund`,
          transaction_id: transactionId,
          customer_user_id: transaction.user_id,
        });

      if (merchantActivityError) {
        console.error('[REFUND] Failed to log merchant PawBucks activity:', merchantActivityError);
      } else {
        console.log('[REFUND] Merchant PawBucks activity logged');
      }
    }

    // Log the admin action
    try {
      await supabaseAdmin.rpc('log_admin_action', {
        _action: 'refund_issued',
        _entity_type: 'transaction',
        _entity_id: transactionId,
        _changes: {
          refund_amount: refundAmount,
          reason: reason || 'requested_by_customer',
          stripe_refund_id: stripeRefund?.id || null,
          pawbucks_deducted: pawbucksEarned,
          pawbucks_refunded: pawbucksUsed,
        },
      });
      console.log('[REFUND] Admin action logged');
    } catch (logError) {
      console.error('[REFUND] Failed to log admin action:', logError);
    }

    console.log('[REFUND] Refund completed successfully');

    return new Response(
      JSON.stringify({ 
        success: true, 
        refund: {
          id: stripeRefund?.id || `internal_${transactionId}`,
          amount: refundAmount,
          status: stripeRefund?.status || 'succeeded',
          pawbucks_deducted: pawbucksEarned,
          pawbucks_refunded: pawbucksUsed,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('[REFUND] Error issuing refund:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
