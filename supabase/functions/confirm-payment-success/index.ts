import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import {
  getSpendableSources,
  planPawBucksDebit,
  applyPawBucksDebit,
} from "../_shared/pet-fund-debit.ts";
import {
  insertTransactionItems,
  itemsToReceiptItems,
  type IncomingTransactionItem,
} from "../_shared/transaction-items.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONFIRM-PAYMENT-SUCCESS] ${step}`, details ? JSON.stringify(details) : "");
};

/**
 * Acquisition-Only enforcement:
 * Returns true if the merchant is acquisition_only AND the user already has a
 * prior completed transaction at this merchant. In that case, NO PawBucks
 * should be awarded to the pet owner.
 */
async function shouldSuppressPawBucksForAcquisitionOnly(
  supabaseAdmin: any,
  userId: string,
  merchantId: string
): Promise<boolean> {
  try {
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('fee_model')
      .eq('id', merchantId)
      .maybeSingle();
    if (merchant?.fee_model !== 'acquisition_only') return false;

    const { count } = await supabaseAdmin
      .from('transactions')
      .select('id', { count: 'exact', head: true })
      .eq('merchant_id', merchantId)
      .eq('user_id', userId)
      .eq('status', 'completed');
    return (count || 0) > 0;
  } catch (e) {
    console.error('[ACQUISITION_ONLY_CHECK] Error', e);
    return false;
  }
}

// Helper function to send receipt email
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
      logStep("Skipping receipt email: config not available");
      return;
    }

    const response = await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseAnonKey}`,
        'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
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

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    logStep("User authenticated", { userId: user.id });

    const { paymentIntentId, connectedAccountId } = await req.json();

    if (!paymentIntentId || !connectedAccountId) {
      throw new Error('Missing paymentIntentId or connectedAccountId');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Check if we already processed this payment
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingTx) {
      logStep("Payment already processed", { transactionId: existingTx.id });
      return new Response(
        JSON.stringify({ success: true, message: "Already processed", transactionId: existingTx.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Retrieve the PaymentIntent from the connected account to verify it succeeded
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(
      paymentIntentId,
      { expand: ['latest_charge'] },
      { stripeAccount: connectedAccountId }
    );

    logStep("PaymentIntent retrieved", { 
      status: paymentIntent.status,
      amount: paymentIntent.amount,
      metadata: paymentIntent.metadata 
    });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not succeeded. Status: ${paymentIntent.status}`);
    }

    const metadata = paymentIntent.metadata || {};
    const userId = metadata.user_id;
    // Shared accounts: PawBucks, Pet Fund and Welcome Credit all live on
    // the primary owner's record. create-combined-payment writes this in
    // metadata so we debit from the correct user.
    const effectiveUserId = metadata.effective_user_id || userId;
    const merchantId = metadata.merchant_id;
    const pawbucksAmount = parseInt(metadata.pawbucks_amount || "0", 10);
    const storeLockedPawbucks = parseInt(metadata.store_locked_pawbucks || "0", 10);
    const totalAmount = parseFloat(metadata.total_amount || "0");

    // Verify user matches
    if (userId !== user.id) {
      throw new Error('User ID mismatch');
    }

    const amountInDollars = paymentIntent.amount / 100;
    const platformFee = amountInDollars * 0.03; // 3% fee
    const pawbucksUsdValue = pawbucksAmount * 0.001;

    // CRITICAL: Determine PawBucks multiplier based on user's subscription tier
    // Default 10x for Free, 20x for PawPass, 30x for PawPass+
    let pawbucksMultiplier = 10;
    let tierName = 'Free';

    try {
      const { data: platformSub } = await supabaseAdmin
        .from('subscriptions')
        .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at')
        .eq('user_id', userId)
        .in('status', ['active', 'trialing'])
        .maybeSingle();

      if (platformSub) {
        // Check manual upgrade first
        if (platformSub.is_manual_upgrade && platformSub.subscription_tier) {
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
        } else if (platformSub.stripe_subscription_id) {
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
      }
      logStep("User subscription tier determined", { tierName, pawbucksMultiplier });
    } catch (tierError) {
      logStep("Error determining tier (using default 10x)", { error: String(tierError) });
    }

    // Calculate PawBucks earned based on Stripe amount and user's tier
    let pawbucksEarned = Math.floor(amountInDollars * pawbucksMultiplier);

    // Acquisition-Only merchants only reward PawBucks on the customer's first visit.
    const suppressAcq = await shouldSuppressPawBucksForAcquisitionOnly(
      supabaseAdmin,
      userId,
      merchantId
    );
    if (suppressAcq) {
      logStep("Acquisition-Only merchant + returning customer → suppressing PawBucks", {
        userId,
        merchantId,
        wouldHaveEarned: pawbucksEarned,
      });
      pawbucksEarned = 0;
    }

    // Get user profile for receipt
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Get merchant details for receipt - ALWAYS use database name, not metadata
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('business_name, address, phone, email')
      .eq('id', merchantId)
      .single();

    // Use the merchant's actual business name from database, not metadata
    const businessName = merchant?.business_name || metadata.business_name || "Merchant";
    const description = `Payment to ${businessName}`;
    
    logStep("Merchant info resolved", { businessName, merchantId });

    // 1. Update direct_payments status
    await supabaseAdmin
      .from("direct_payments")
      .update({ status: "succeeded" })
      .eq("stripe_payment_intent_id", paymentIntentId);

    logStep("Direct payment status updated");

    // 2. Create transaction record
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
        cashback_earned: pawbucksEarned, // Same as rewards_earned
        stripe_payment_intent_id: paymentIntentId,
        description: description,
      })
      .select()
      .single();

    if (txError) {
      // Handle duplicate key violation (race condition: two calls for same payment intent)
      if (txError.code === '23505' && txError.message?.includes('idx_transactions_unique_stripe_pi')) {
        logStep("Duplicate transaction blocked by unique constraint, fetching existing", { paymentIntentId });
        const { data: existingTx2 } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single();
        return new Response(
          JSON.stringify({ success: true, message: "Already processed", transactionId: existingTx2?.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      logStep("Error creating transaction", { error: txError.message });
      throw new Error("Failed to create transaction record");
    }

    logStep("Transaction record created", { transactionId: transaction.id });

    // Load line items stashed by create-combined-payment in direct_payments.metadata
    let lineItems: IncomingTransactionItem[] = [];
    try {
      const { data: dp } = await supabaseAdmin
        .from("direct_payments")
        .select("metadata")
        .eq("stripe_payment_intent_id", paymentIntentId)
        .maybeSingle();
      const rawItems = (dp as any)?.metadata?.items;
      if (Array.isArray(rawItems)) lineItems = rawItems;
    } catch (e) {
      logStep("Could not load line items from direct_payments (non-fatal)", { error: String(e) });
    }

    if (lineItems.length > 0) {
      await insertTransactionItems(supabaseAdmin, {
        transactionId: transaction.id,
        merchantId,
        items: lineItems,
      });
    }

    // 3. Award PawBucks to user (only if not already credited for this payment intent)
    if (pawbucksEarned > 0) {
      // Check if PawBucks were already credited (e.g., by create-merchant-subscription)
      const { data: existingCredit } = await supabaseAdmin
        .from("pawbucks_activity")
        .select("id")
        .eq("user_id", userId)
        .eq("transaction_id", transaction.id)
        .eq("type", "earn")
        .limit(1);

      if (existingCredit && existingCredit.length > 0) {
        logStep("PawBucks already credited for this transaction, skipping", { transactionId: transaction.id });
      } else {
      // Log activity with correct type 'earn' (matches what PawBucksWallet.tsx filters for)
      const { error: activityError } = await supabaseAdmin
        .from("pawbucks_activity")
        .insert({
          user_id: userId,
          amount: pawbucksEarned,
          type: "earn", // CRITICAL: Must be 'earn' not 'credit' for wallet activity display
          source: "direct_payment",
          description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from payment to ${businessName}`,
          pawbucks_status: "available",
          partner_id: merchantId,
          transaction_id: transaction.id,
        });

      if (activityError) {
        logStep("Error inserting pawbucks_activity", { error: activityError.message });
      } else {
        logStep("PawBucks activity logged", { amount: pawbucksEarned, type: "earn" });
      }

      // Update wallet balance
      const { data: wallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        const { error: walletError } = await supabaseAdmin
          .from('pawbucks_wallet')
          .update({ balance: wallet.balance + pawbucksEarned })
          .eq('user_id', userId);
        
        if (walletError) {
          logStep("Error updating wallet balance", { error: walletError.message });
        } else {
          logStep("PawBucks wallet updated", { 
            previousBalance: wallet.balance, 
            newBalance: wallet.balance + pawbucksEarned,
            earned: pawbucksEarned 
          });
        }
      } else {
        logStep("Wallet not found for user, creating one", { userId });
        await supabaseAdmin.from('pawbucks_wallet').insert({
          user_id: userId,
          balance: pawbucksEarned,
        });
      }
      } // end else (no existing credit)
    }

    // 4. Deduct PawBucks if user used any
    if (pawbucksAmount > 0) {
      const debitSources = await getSpendableSources(supabaseAdmin, effectiveUserId);
      const debitPlan = planPawBucksDebit(debitSources, pawbucksAmount, totalAmount > 0 ? totalAmount : amountInDollars);
      await applyPawBucksDebit(supabaseAdmin, effectiveUserId, debitPlan, {
        merchantId,
        transactionId: transaction.id,
        transactionTotalCents: Math.round((totalAmount > 0 ? totalAmount : amountInDollars) * 100),
      });

      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: effectiveUserId,
        amount: pawbucksAmount,
        type: 'redeem',
        source: 'merchant_payment',
        description: `Payment to ${businessName}`,
        partner_id: merchantId,
        transaction_id: transaction.id,
      });

      if (debitPlan.walletDeduction > 0) {
        try {
          const { data: brandedRedeem, error: brandedRedeemErr } = await supabaseAdmin.rpc(
            "redeem_branded_pawbucks_v2",
            {
              p_user_id: userId,
              p_merchant_id: merchantId,
              p_amount: debitPlan.walletDeduction,
              p_line_items: [],
              p_transaction_id: transaction.id,
              p_description: `Branded PawBucks redeemed at ${businessName}`,
            },
          );
          if (brandedRedeemErr) {
            logStep("Branded PawBucks redemption tracking failed (non-fatal)", { error: brandedRedeemErr.message });
          } else if ((brandedRedeem as any)?.redeemed > 0) {
            logStep("Branded PawBucks redemption tracked", brandedRedeem as any);
          }
        } catch (e) {
          logStep("Branded PawBucks redemption tracking exception (non-fatal)", { error: (e as Error).message });
        }
      }

      // Credit merchant's PawBucks wallet (full pawbucksAmount)
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

      await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchantId,
        type: 'earn',
        amount: pawbucksAmount,
        source: 'Customer Payment',
        customer_user_id: userId,
        description: `Received ${pawbucksAmount} PawBucks from customer`,
      });

      logStep("PawBucks deducted and credited to merchant", { pawbucksAmount, ...debitPlan });
    }

    // 4a. Deduct store-locked (in-store) PawBucks NOW that Stripe has confirmed.
    // We deliberately defer this debit until after PaymentIntent.status === 'succeeded'
    // so users never lose in-store PawBucks if the card fails or checkout is abandoned.
    if (storeLockedPawbucks > 0) {
      const { data: slpbRedeem, error: slpbRedeemErr } = await supabaseAdmin.rpc(
        'redeem_store_locked_pawbucks',
        {
          p_merchant_id: merchantId,
          p_user_id: userId,
          p_amount_pb: storeLockedPawbucks,
          p_transaction_id: transaction.id,
          p_description: `In-store PawBucks redemption at ${businessName}`,
        }
      );
      if (slpbRedeemErr || !(slpbRedeem as any)?.success) {
        // Do NOT fail the transaction — Stripe already charged the card.
        // Log loudly so it can be reconciled manually.
        logStep('ERROR: store-locked PawBucks debit failed after Stripe success', {
          transactionId: transaction.id,
          storeLockedPawbucks,
          error: (slpbRedeem as any)?.error || slpbRedeemErr?.message,
        });
      } else {
        logStep('Store-locked PawBucks debited (post-Stripe)', { storeLockedPawbucks });
      }
    }

    // 4b. Handle referrer bonus activation on first purchase
    // If this is the user's first completed transaction AND they were referred, activate the referrer bonus
    try {
      const { count: completedTxCount } = await supabaseAdmin
        .from('transactions')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .eq('status', 'completed');

      if (completedTxCount === 1) {
        // This is their first completed transaction
        const transactionTotal = totalAmount > 0 ? totalAmount : amountInDollars;
        
        if (transactionTotal >= 40) {
          // Check for pending referrer bonus
          const { data: pendingBonus } = await supabaseAdmin
            .from('pet_fund_referrer_bonuses')
            .select('id, referrer_id')
            .eq('referee_id', userId)
            .eq('status', 'pending')
            .maybeSingle();

          if (pendingBonus) {
            // Get the referee's 2nd month release date to set the unlock date
            const { data: month2Release } = await supabaseAdmin
              .from('pet_fund_releases')
              .select('scheduled_at')
              .eq('user_id', userId)
              .eq('month_number', 2)
              .maybeSingle();

            const releaseAt = month2Release?.scheduled_at || new Date(Date.now() + 60 * 24 * 60 * 60 * 1000).toISOString();

            await supabaseAdmin
              .from('pet_fund_referrer_bonuses')
              .update({
                status: 'locked',
                release_at: releaseAt,
              })
              .eq('id', pendingBonus.id);

            // Notify referrer
            await supabaseAdmin.from('notifications').insert({
              user_id: pendingBonus.referrer_id,
              title: '🎉 Referral Bonus Earned!',
              message: `Your friend made their first purchase! You've earned 10,000 PawBucks ($10) that will unlock soon.`,
              category: 'promotional',
            });

            logStep("Referrer bonus activated", { bonusId: pendingBonus.id, referrerId: pendingBonus.referrer_id, releaseAt });
          }
        }
      }
    } catch (refErr) {
      logStep("Error processing referrer bonus", { error: String(refErr) });
    }

    // 5. Auto-log platform fee AND Stripe processing fee as separate Tax Vault expenses
    if (merchantId && amountInDollars > 0) {
      const expenseDate = new Date().toISOString().split('T')[0];
      const taxYear = new Date().getFullYear();

      // Retrieve the actual Stripe processing fee from the charge's balance_transaction
      let stripeProcessingFee = 0;
      try {
        const latestCharge = paymentIntent.latest_charge;
        if (latestCharge && typeof latestCharge === 'object' && 'balance_transaction' in latestCharge) {
          const charge = latestCharge as Stripe.Charge;
          if (charge.balance_transaction && typeof charge.balance_transaction === 'string') {
            const balanceTx = await stripe.balanceTransactions.retrieve(
              charge.balance_transaction,
              { stripeAccount: connectedAccountId }
            );
            // Total Stripe fee includes application_fee; isolate processing fee
            const totalStripeFee = balanceTx.fee / 100;
            stripeProcessingFee = Math.max(0, totalStripeFee - platformFee);
          }
        }
      } catch (feeError) {
        logStep("Could not retrieve Stripe processing fee, estimating", { error: String(feeError) });
        stripeProcessingFee = Math.round((amountInDollars * 0.029 + 0.30) * 100) / 100;
      }

      const expenseRows = [];

      // Log PawBucks Success Fee (3%)
      if (platformFee > 0) {
        expenseRows.push({
          merchant_id: merchantId,
          category: "platform_fees" as const,
          amount: platformFee,
          description: `PawBucks Success Fee (3%) on $${amountInDollars.toFixed(2)} sale`,
          vendor_name: "PawBucks Network",
          expense_date: expenseDate,
          tax_year: taxYear,
          is_auto_logged: true,
          source_purchase_id: paymentIntentId,
        });
      }

      // Log Stripe Processing Fee
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
          source_purchase_id: `${paymentIntentId}_processing`,
        });
      }

      if (expenseRows.length > 0) {
        await supabaseAdmin.from("merchant_tax_expenses").insert(expenseRows);
        logStep("Fees auto-logged to Tax Vault", { platformFee, stripeProcessingFee });
      }
    }

    // NOTE: Merchants only earn PawBucks when customers USE PawBucks in payment
    // No commission on card-only payments

    // 7. Send receipt email
    const customerEmail = userProfile?.email || user.email;
    if (customerEmail) {
      // Get card details if available
      let cardBrand: string | undefined;
      let cardLast4: string | undefined;

      const latestCharge = paymentIntent.latest_charge;
      if (latestCharge && typeof latestCharge === 'object' && 'payment_method_details' in latestCharge) {
        const charge = latestCharge as Stripe.Charge;
        if (charge.payment_method_details?.card) {
          cardBrand = charge.payment_method_details.card.brand || undefined;
          cardLast4 = charge.payment_method_details.card.last4 || undefined;
        }
      }

      await sendReceiptEmail({
        email: customerEmail,
        customerName: userProfile?.full_name || undefined,
        transactionDate: new Date().toISOString(),
        receiptId: transaction.id,
        merchantName: merchant?.business_name || businessName,
        merchantLocation: merchant?.address || undefined,
        merchantPhone: (merchant as any)?.phone || undefined,
        merchantEmail: (merchant as any)?.email || undefined,
        items: [{ name: description, price: totalAmount > 0 ? totalAmount : amountInDollars }],
        subtotal: totalAmount > 0 ? totalAmount : amountInDollars,
        pawbucksApplied: pawbucksUsdValue,
        cardAmount: amountInDollars,
        totalPaid: totalAmount > 0 ? totalAmount : amountInDollars,
        cardBrand,
        cardLast4,
        pawbucksEarned,
      });
    }

    // 8. Send in-app notification and email to merchant
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
                  merchantName: merchantForNotif.business_name || merchantProfile.full_name || 'Merchant',
                  invoiceNumber: `PAY-${transaction.id.substring(0, 8).toUpperCase()}`,
                  invoiceTitle: description,
                  clientName: userProfile?.full_name || 'Customer',
                  clientEmail: customerEmail || '',
                  amountPaid: totalAmount > 0 ? totalAmount : amountInDollars,
                  pawbucksUsed: pawbucksAmount,
                  paymentMethod: pawbucksAmount > 0 ? 'mixed' : 'credit_card',
                  paymentDate: new Date().toISOString(),
                  invoiceTotal: totalAmount > 0 ? totalAmount : amountInDollars,
                  amountDue: 0,
                }),
              }).catch(err => console.error("Merchant notification error:", err));
            }
          }
        }
      } catch (notifError) {
        logStep("Error sending merchant notification", { error: String(notifError) });
      }
    }

    // Trigger loyalty punch card advancement
    if (transaction?.id && userId && merchantId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      fetch(`${supabaseUrl}/functions/v1/loyalty-punch-advance`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
        },
        body: JSON.stringify({
          transaction_id: transaction.id,
          user_id: userId,
          merchant_id: merchantId,
        }),
      }).catch(err => logStep("Loyalty punch error", { error: String(err) }));

      // Trigger loyalty milestone advancement (Your Rewards system)
      fetch(`${supabaseUrl}/functions/v1/advance-loyalty-milestones`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
          'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
        },
        body: JSON.stringify({
          transaction_id: transaction.id,
          user_id: userId,
          merchant_id: merchantId,
          cash_amount: amountInDollars,
        }),
      }).catch(err => logStep("Loyalty milestone error", { error: String(err) }));
    }

    // Trigger branded PawBucks distribution for "checkout" trigger type
    if (merchantId && userId) {
      const supabaseUrl = Deno.env.get('SUPABASE_URL');
      fetch(`${supabaseUrl}/functions/v1/distribute-branded-pawbucks`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({
          user_id: userId,
          merchant_id: merchantId,
          trigger: 'checkout',
          transaction_amount_usd: amountInDollars,
          transaction_id: transaction.id,
        }),
      }).catch(err => logStep("Branded PB checkout distribution error", { error: String(err) }));
    }

    logStep("Payment processing complete", { 
      transactionId: transaction.id,
      pawbucksEarned,
      pawbucksUsed: pawbucksAmount 
    });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        pawbucksEarned,
        message: "Payment confirmed and rewards distributed",
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Confirm payment error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
