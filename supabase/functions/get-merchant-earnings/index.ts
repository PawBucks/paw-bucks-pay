import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[GET-MERCHANT-EARNINGS] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) throw new Error("STRIPE_SECRET_KEY is not set");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("No authorization header provided");

    const token = authHeader.replace("Bearer ", "");
    const { data: userData, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError) throw new Error(`Authentication error: ${userError.message}`);
    
    const user = userData.user;
    if (!user) throw new Error("User not authenticated");
    logStep("User authenticated", { userId: user.id });

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from("merchants")
      .select("*")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error("Merchant not found");
    }

    if (!merchant.stripe_account_id) {
      return new Response(JSON.stringify({
        connected: false,
        message: "No Stripe account connected"
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Fetching balance from Stripe", { accountId: merchant.stripe_account_id });

    const stripe = new Stripe(stripeKey, { apiVersion: "2024-12-18.acacia" });
    const stripeAccountOpts = { stripeAccount: merchant.stripe_account_id };

    // Fetch balance, account info, and payouts in parallel
    const [balance, account, allPayoutsResult, chargesResult, disputesResult] = await Promise.all([
      stripe.balance.retrieve({}, stripeAccountOpts),
      stripe.accounts.retrieve(merchant.stripe_account_id),
      (async () => {
        const payouts: Stripe.Payout[] = [];
        for await (const payout of stripe.payouts.list({ limit: 100 }, stripeAccountOpts)) {
          payouts.push(payout);
        }
        return payouts;
      })(),
      stripe.charges.list({ limit: 20 }, stripeAccountOpts),
      stripe.disputes.list({ limit: 10 }, stripeAccountOpts).catch(() => ({ data: [] })),
    ]);

    logStep("Parallel Stripe fetches complete", { 
      payoutCount: allPayoutsResult.length,
      chargeCount: chargesResult.data.length,
      disputeCount: disputesResult.data.length,
    });

    // Extract payout schedule from account settings
    const payoutSchedule = account.settings?.payouts?.schedule || null;
    const payoutsEnabled = account.payouts_enabled || false;

    // Compute estimated arrival for pending balance from upcoming payouts
    const pendingPayouts = allPayoutsResult.filter((p: any) => ["pending", "in_transit"].includes(p.status));
    const nextArrivalDate = pendingPayouts.length > 0
      ? Math.min(...pendingPayouts.map((p: any) => p.arrival_date))
      : null;

    // Fetch balance transactions to get fee breakdown for charges
    const chargesWithFees = await Promise.all(
      chargesResult.data.map(async (charge: Stripe.Charge) => {
        let totalStripeFeePlusAppFee = 0;
        let netAmount = charge.amount;
        
        if (charge.balance_transaction && typeof charge.balance_transaction === 'string') {
          try {
            const balanceTx = await stripe.balanceTransactions.retrieve(
              charge.balance_transaction,
              stripeAccountOpts
            );
            totalStripeFeePlusAppFee = balanceTx.fee || 0;
            netAmount = balanceTx.net || charge.amount;
          } catch (e) {
            logStep("Could not fetch balance transaction", { chargeId: charge.id, error: String(e) });
          }
        }
        
        const applicationFeeAmount = charge.application_fee_amount || 0;
        const stripeProcessingFee = Math.max(0, totalStripeFeePlusAppFee - applicationFeeAmount);
        
        return {
          ...charge,
          stripe_fee: stripeProcessingFee,
          application_fee: applicationFeeAmount,
          total_fees: totalStripeFeePlusAppFee,
          net_amount: netAmount,
        };
      })
    );

    logStep("Charges with fees retrieved", { count: chargesWithFees.length });

    // Batch ALL Supabase queries in parallel instead of sequential
    const [
      { data: directPayments, error: directPaymentsError },
      { data: directPaymentTotals },
      { data: refundedDirectPayments },
      { data: transactions, error: transactionsError },
      { data: transactionTotals },
      { data: refundedTransactions },
    ] = await Promise.all([
      supabaseAdmin.from("direct_payments").select("*").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("direct_payments").select("amount, application_fee, status").eq("merchant_id", merchant.id).eq("status", "succeeded"),
      supabaseAdmin.from("direct_payments").select("amount, application_fee").eq("merchant_id", merchant.id).eq("status", "refunded"),
      supabaseAdmin.from("transactions").select("id, amount, cashback_earned, rewards_earned, status, created_at, description").eq("merchant_id", merchant.id).order("created_at", { ascending: false }).limit(50),
      supabaseAdmin.from("transactions").select("amount, cashback_earned, rewards_earned, stripe_amount, application_fee").eq("merchant_id", merchant.id).eq("status", "completed"),
      supabaseAdmin.from("transactions").select("amount, amount_refunded, cashback_earned, rewards_earned").eq("merchant_id", merchant.id).in("status", ["refunded", "partially_refunded"]),
    ]);

    if (directPaymentsError) logStep("Error fetching direct payments", { error: directPaymentsError.message });
    if (transactionsError) logStep("Error fetching transactions", { error: transactionsError.message });

    const directPaymentEarnings = directPaymentTotals?.reduce((sum, p) => sum + (Number(p.amount || 0) - Number(p.application_fee || 0)), 0) || 0;
    const directPaymentFees = directPaymentTotals?.reduce((sum, p) => sum + Number(p.application_fee || 0), 0) || 0;
    const refundedDirectAmount = refundedDirectPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

    const transactionEarnings = transactionTotals?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const transactionCashback = transactionTotals?.reduce((sum, t) => sum + Number(t.cashback_earned || 0), 0) || 0;
    const transactionRewards = transactionTotals?.reduce((sum, t) => sum + Number(t.rewards_earned || 0), 0) || 0;
    const transactionFeeCents = transactionTotals?.reduce((sum, t) => sum + Math.round(Number(t.application_fee || 0) * 100), 0) || 0;
    const transactionFees = transactionFeeCents / 100;
    const transactionCount = transactionTotals?.length || 0;

    // Calculate refund totals
    // Use the recorded refunded amount when present (supports partial refunds),
    // falling back to the full transaction amount for full refunds.
    const refundedTransactionAmount = refundedTransactions?.reduce(
      (sum, t) => sum + (Number(t.amount_refunded || 0) > 0 ? Number(t.amount_refunded) : Number(t.amount || 0)),
      0,
    ) || 0;
    const refundedTransactionCount = refundedTransactions?.length || 0;
    const totalRefundedAmount = (refundedDirectAmount / 100) + refundedTransactionAmount;
    const totalRefundedCount = (refundedDirectPayments?.length || 0) + refundedTransactionCount;

    // Combine both sources for total earnings
    const totalEarningsFromDirect = directPaymentEarnings / 100;
    const totalEarningsFromTransactions = transactionEarnings;
    const combinedTotalEarnings = totalEarningsFromDirect + totalEarningsFromTransactions;
    const combinedTransactionCount = (directPaymentTotals?.length || 0) + transactionCount;
    const combinedFees = (directPaymentFees / 100) + transactionFees;
    const combinedRewardsGiven = transactionCashback + transactionRewards;

    // Disputes summary
    const openDisputes = disputesResult.data.filter((d: Stripe.Dispute) => 
      ["warning_needs_response", "needs_response", "warning_under_review", "under_review"].includes(d.status)
    );
    const disputesSummary = {
      total: disputesResult.data.length,
      open: openDisputes.length,
      totalAmount: disputesResult.data.reduce((sum: number, d: Stripe.Dispute) => sum + d.amount, 0),
      disputes: disputesResult.data.slice(0, 5).map((d: Stripe.Dispute) => ({
        id: d.id,
        amount: d.amount,
        currency: d.currency,
        status: d.status,
        reason: d.reason,
        created: d.created,
        chargeId: typeof d.charge === 'string' ? d.charge : d.charge?.id,
      })),
    };

    return new Response(JSON.stringify({
      connected: true,
      accountId: merchant.stripe_account_id,
      balance: {
        available: balance.available,
        pending: balance.pending,
      },
      payoutSchedule: payoutSchedule ? {
        interval: payoutSchedule.interval,
        delay_days: payoutSchedule.delay_days,
        weekly_anchor: payoutSchedule.weekly_anchor || null,
        monthly_anchor: payoutSchedule.monthly_anchor || null,
      } : null,
      payoutsEnabled,
      estimatedNextArrival: nextArrivalDate,
      payoutHistory: allPayoutsResult.map((p: Stripe.Payout) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date,
        created: p.created,
        method: p.method,
        type: p.type,
        description: p.description,
      })),
      recentCharges: chargesWithFees.slice(0, 10).map((c: Stripe.Charge & { stripe_fee: number; application_fee: number; total_fees: number; net_amount: number }) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        created: c.created,
        description: c.description,
        stripeFee: c.stripe_fee,
        applicationFee: c.application_fee,
        totalFees: c.total_fees,
        netAmount: c.net_amount,
      })),
      disputes: disputesSummary,
      directPayments: directPayments || [],
      transactions: transactions || [],
      summary: {
        totalEarnings: combinedTotalEarnings,
        totalFees: combinedFees,
        transactionCount: combinedTransactionCount,
        totalRewardsGiven: combinedRewardsGiven,
        refunds: {
          count: totalRefundedCount,
          amount: totalRefundedAmount,
        },
        breakdown: {
          directPaymentEarnings: totalEarningsFromDirect,
          directPaymentFees: directPaymentFees / 100,
          directPaymentCount: directPaymentTotals?.length || 0,
          transactionEarnings: totalEarningsFromTransactions,
          transactionCashbackPawBucks: transactionCashback,
          transactionRewardsPawBucks: transactionRewards,
          transactionCount: transactionCount,
        }
      },
      dashboardUrl: null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
