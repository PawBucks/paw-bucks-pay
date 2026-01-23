import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    const stripe = new Stripe(stripeKey, { apiVersion: "2025-08-27.basil" });

    // Fetch balance from connected account using stripeAccount header
    const balance = await stripe.balance.retrieve(
      {},
      { stripeAccount: merchant.stripe_account_id }
    );

    logStep("Balance retrieved", { balance });

    // Fetch recent payouts
    const payouts = await stripe.payouts.list(
      { limit: 10 },
      { stripeAccount: merchant.stripe_account_id }
    );

    logStep("Payouts retrieved", { count: payouts.data.length });

    // Fetch recent charges
    const charges = await stripe.charges.list(
      { limit: 20 },
      { stripeAccount: merchant.stripe_account_id }
    );

    logStep("Charges retrieved", { count: charges.data.length });

    // Get payment history from direct_payments table
    const { data: directPayments, error: directPaymentsError } = await supabaseAdmin
      .from("direct_payments")
      .select("*")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (directPaymentsError) {
      logStep("Error fetching direct payments", { error: directPaymentsError.message });
    }

    // Calculate totals from direct_payments (only succeeded, not refunded)
    const { data: directPaymentTotals } = await supabaseAdmin
      .from("direct_payments")
      .select("amount, application_fee, status")
      .eq("merchant_id", merchant.id)
      .eq("status", "succeeded");

    // Also get refunded direct payments for tracking
    const { data: refundedDirectPayments } = await supabaseAdmin
      .from("direct_payments")
      .select("amount, application_fee")
      .eq("merchant_id", merchant.id)
      .eq("status", "refunded");

    const directPaymentEarnings = directPaymentTotals?.reduce((sum, p) => sum + (p.amount - p.application_fee), 0) || 0;
    const directPaymentFees = directPaymentTotals?.reduce((sum, p) => sum + p.application_fee, 0) || 0;
    const refundedDirectAmount = refundedDirectPayments?.reduce((sum, p) => sum + p.amount, 0) || 0;

    // ALSO get transaction history from transactions table (main source)
    const { data: transactions, error: transactionsError } = await supabaseAdmin
      .from("transactions")
      .select("id, amount, cashback_earned, rewards_earned, status, created_at, description")
      .eq("merchant_id", merchant.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (transactionsError) {
      logStep("Error fetching transactions", { error: transactionsError.message });
    }

    // Calculate totals from transactions table (completed transactions ONLY - excludes refunded)
    const { data: transactionTotals } = await supabaseAdmin
      .from("transactions")
      .select("amount, cashback_earned, rewards_earned, stripe_amount, application_fee")
      .eq("merchant_id", merchant.id)
      .eq("status", "completed");

    // Get refunded transactions separately for tracking
    const { data: refundedTransactions } = await supabaseAdmin
      .from("transactions")
      .select("amount, cashback_earned, rewards_earned")
      .eq("merchant_id", merchant.id)
      .eq("status", "refunded");

    const transactionEarnings = transactionTotals?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const transactionCashback = transactionTotals?.reduce((sum, t) => sum + Number(t.cashback_earned || 0), 0) || 0;
    const transactionRewards = transactionTotals?.reduce((sum, t) => sum + Number(t.rewards_earned || 0), 0) || 0;
    // Use actual application_fee from transactions (accurate - only charges fee on Stripe portion)
    const transactionFees = transactionTotals?.reduce((sum, t) => sum + Number(t.application_fee || 0), 0) || 0;
    const transactionCount = transactionTotals?.length || 0;

    // Calculate refund totals
    const refundedTransactionAmount = refundedTransactions?.reduce((sum, t) => sum + Number(t.amount || 0), 0) || 0;
    const refundedTransactionCount = refundedTransactions?.length || 0;
    const totalRefundedAmount = (refundedDirectAmount / 100) + refundedTransactionAmount;
    const totalRefundedCount = (refundedDirectPayments?.length || 0) + refundedTransactionCount;

    logStep("Transaction totals calculated", { 
      transactionEarnings, 
      transactionCashback,
      transactionRewards,
      transactionCount,
      directPaymentEarnings: directPaymentEarnings / 100,
      directPaymentCount: directPaymentTotals?.length || 0,
      refundedAmount: totalRefundedAmount,
      refundedCount: totalRefundedCount
    });

    // Combine both sources for total earnings (ONLY completed/succeeded - refunds excluded)
    // direct_payments are in cents, transactions are in dollars
    const totalEarningsFromDirect = directPaymentEarnings / 100; // Convert cents to dollars
    const totalEarningsFromTransactions = transactionEarnings;
    const combinedTotalEarnings = totalEarningsFromDirect + totalEarningsFromTransactions;
    const combinedTransactionCount = (directPaymentTotals?.length || 0) + transactionCount;
    // Use actual application_fee values (accurate - only on Stripe portion, not PawBucks)
    const combinedFees = (directPaymentFees / 100) + transactionFees;
    const combinedRewardsGiven = transactionCashback + transactionRewards; // Total rewards given to customers (in PawBucks)

    // Create Stripe Express Dashboard login link
    let dashboardUrl = null;
    try {
      // Express accounts support login links for the Express Dashboard
      const loginLink = await stripe.accounts.createLoginLink(merchant.stripe_account_id);
      dashboardUrl = loginLink.url;
      logStep("Express Dashboard login link created");
    } catch (e) {
      logStep("Could not create Express Dashboard link", { error: String(e) });
      // Fallback - should rarely happen with Express accounts
      dashboardUrl = null;
    }

    return new Response(JSON.stringify({
      connected: true,
      accountId: merchant.stripe_account_id,
      balance: {
        available: balance.available,
        pending: balance.pending,
      },
      recentPayouts: payouts.data.map((p: Stripe.Payout) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrivalDate: p.arrival_date,
        created: p.created,
      })),
      recentCharges: charges.data.slice(0, 10).map((c: Stripe.Charge) => ({
        id: c.id,
        amount: c.amount,
        currency: c.currency,
        status: c.status,
        created: c.created,
        description: c.description,
      })),
      directPayments: directPayments || [],
      transactions: transactions || [],
      summary: {
        totalEarnings: combinedTotalEarnings,
        totalFees: combinedFees,
        transactionCount: combinedTransactionCount,
        totalRewardsGiven: combinedRewardsGiven,
        // Refund tracking
        refunds: {
          count: totalRefundedCount,
          amount: totalRefundedAmount,
        },
        // Breakdown for transparency
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
      dashboardUrl,
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
