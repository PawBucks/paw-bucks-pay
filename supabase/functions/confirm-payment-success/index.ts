import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONFIRM-PAYMENT-SUCCESS] ${step}`, details ? JSON.stringify(details) : "");
};

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
    const merchantId = metadata.merchant_id;
    const pawbucksAmount = parseInt(metadata.pawbucks_amount || "0", 10);
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
    const pawbucksEarned = Math.floor(amountInDollars * pawbucksMultiplier);

    // Get user profile for receipt
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name')
      .eq('id', user.id)
      .single();

    // Get merchant details for receipt - ALWAYS use database name, not metadata
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('business_name, address')
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
      logStep("Error creating transaction", { error: txError.message });
      throw new Error("Failed to create transaction record");
    }

    logStep("Transaction record created", { transactionId: transaction.id });

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
      // Get wallet balance
      const { data: userWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      const walletBalance = userWallet?.balance || 0;

      // Check for Pet Fund (new system) or legacy welcome credit
      let walletDeduction = Math.min(walletBalance, pawbucksAmount);
      let petFundDeduction = 0;
      let welcomeCreditDeduction = 0;

      if (walletDeduction < pawbucksAmount) {
        const remaining = pawbucksAmount - walletDeduction;

        // Check Pet Fund first (new system)
        const { data: petFundLedger } = await supabaseAdmin
          .from('pet_fund_ledgers')
          .select('id, available_balance')
          .eq('user_id', userId)
          .eq('status', 'active')
          .maybeSingle();

        if (petFundLedger && petFundLedger.available_balance > 0) {
          petFundDeduction = Math.min(remaining, petFundLedger.available_balance);
        }

        // Fall back to legacy welcome credit if pet fund doesn't cover it
        const stillRemaining = remaining - petFundDeduction;
        if (stillRemaining > 0) {
          const { data: welcomeCredit } = await supabaseAdmin
            .from('user_welcome_credits')
            .select('id, credit_amount, status, expires_at')
            .eq('user_id', userId)
            .eq('status', 'active')
            .maybeSingle();

          if (welcomeCredit && new Date(welcomeCredit.expires_at) > new Date()) {
            welcomeCreditDeduction = Math.min(stillRemaining, welcomeCredit.credit_amount);
          }
        }
      }

      // Deduct from wallet
      if (walletDeduction > 0 && walletBalance >= walletDeduction) {
        await supabaseAdmin
          .from('pawbucks_wallet')
          .update({ balance: walletBalance - walletDeduction })
          .eq('user_id', userId);

        await supabaseAdmin.from('pawbucks_activity').insert({
          user_id: userId,
          amount: -walletDeduction,
          type: 'redemption',
          source: 'merchant_payment',
          description: `Payment to ${businessName}`,
          partner_id: merchantId,
        });
      }

      // Deduct from Pet Fund
      if (petFundDeduction > 0) {
        // Find the oldest available (released, unused) release
        const { data: availableReleases } = await supabaseAdmin
          .from('pet_fund_releases')
          .select('id, amount, month_number')
          .eq('user_id', userId)
          .eq('status', 'released')
          .is('used_at', null)
          .order('month_number', { ascending: true });

        let remainingDeduction = petFundDeduction;
        for (const release of (availableReleases || [])) {
          if (remainingDeduction <= 0) break;
          const deductFromRelease = Math.min(remainingDeduction, release.amount);
          
          // Mark release as used
          await supabaseAdmin
            .from('pet_fund_releases')
            .update({ used_at: new Date().toISOString() })
            .eq('id', release.id);
          
          remainingDeduction -= deductFromRelease;
        }

        // Update ledger balances
        await supabaseAdmin
          .from('pet_fund_ledgers')
          .update({
            available_balance: supabaseAdmin.rpc ? undefined : 0, // Will be handled below
            total_used: supabaseAdmin.rpc ? undefined : 0,
          })
          .eq('user_id', userId);

        // Use raw SQL update via RPC for atomic balance update
        await supabaseAdmin.rpc('release_pet_fund_installment', { p_release_id: (availableReleases || [])[0]?.id }).catch(() => {
          // Fallback: manually update ledger
        });

        // Manual ledger update
        const { data: currentLedger } = await supabaseAdmin
          .from('pet_fund_ledgers')
          .select('available_balance, total_used')
          .eq('user_id', userId)
          .single();

        if (currentLedger) {
          await supabaseAdmin
            .from('pet_fund_ledgers')
            .update({
              available_balance: Math.max(0, currentLedger.available_balance - petFundDeduction),
              total_used: currentLedger.total_used + petFundDeduction,
            })
            .eq('user_id', userId);
        }

        logStep("Pet Fund deducted", { amount: petFundDeduction });
      }

      // Redeem legacy welcome credit if needed
      if (welcomeCreditDeduction > 0) {
        const totalCents = Math.round(amountInDollars * 100);
        await supabaseAdmin.rpc('redeem_welcome_credit', {
          p_user_id: userId,
          p_merchant_id: merchantId,
          p_transaction_total_cents: totalCents,
        });
        logStep("Welcome credit redeemed", { amount: welcomeCreditDeduction });
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

      logStep("PawBucks deducted and credited to merchant", { pawbucksAmount, walletDeduction, petFundDeduction, welcomeCreditDeduction });
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

      // Log PawBucks Network Fee (3%)
      if (platformFee > 0) {
        expenseRows.push({
          merchant_id: merchantId,
          category: "platform_fees" as const,
          amount: platformFee,
          description: `PawBucks Network Fee (3%) on $${amountInDollars.toFixed(2)} sale`,
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
                  merchantName: merchantProfile.full_name || merchantForNotif.business_name || 'Merchant',
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
        },
        body: JSON.stringify({
          transaction_id: transaction.id,
          user_id: userId,
          merchant_id: merchantId,
        }),
      }).catch(err => logStep("Loyalty punch error", { error: String(err) }));
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
