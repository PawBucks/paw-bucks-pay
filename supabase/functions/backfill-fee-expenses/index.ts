import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[BACKFILL-FEES] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY")!;

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2024-12-18.acacia" });

    // Auth check - must be a merchant user
    const supabaseClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!
    );
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get merchant for this user
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, stripe_account_id")
      .eq("user_id", user.id)
      .single();

    if (merchantError || !merchant) {
      return new Response(JSON.stringify({ error: "Merchant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!merchant.stripe_account_id) {
      return new Response(JSON.stringify({ error: "No Stripe account connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Starting backfill", { merchantId: merchant.id, stripeAccount: merchant.stripe_account_id });

    // Get all existing expense source_purchase_ids to avoid duplicates
    const { data: existingExpenses } = await supabase
      .from("merchant_tax_expenses")
      .select("source_purchase_id")
      .eq("merchant_id", merchant.id)
      .in("category", ["platform_fees", "processing_fees"])
      .not("source_purchase_id", "is", null);

    const existingIds = new Set((existingExpenses || []).map(e => e.source_purchase_id));

    // Get all completed transactions for this merchant
    const { data: transactions } = await supabase
      .from("transactions")
      .select("id, stripe_payment_intent_id, amount, stripe_amount, application_fee, created_at, status")
      .eq("merchant_id", merchant.id)
      .eq("status", "completed")
      .not("stripe_payment_intent_id", "is", null)
      .order("created_at", { ascending: true });

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ success: true, message: "No transactions to backfill", count: 0 }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    logStep("Found transactions to process", { count: transactions.length });

    let backfilledPlatform = 0;
    let backfilledProcessing = 0;
    let skipped = 0;
    const newExpenses: Array<{
      merchant_id: string;
      category: string;
      amount: number;
      description: string;
      vendor_name: string;
      expense_date: string;
      tax_year: number;
      is_auto_logged: boolean;
      source_purchase_id: string;
    }> = [];

    for (const tx of transactions) {
      const piId = tx.stripe_payment_intent_id!;
      const stripeAmount = tx.stripe_amount || tx.amount;
      const platformFee = tx.application_fee || stripeAmount * 0.03;
      const txDate = new Date(tx.created_at);
      const expenseDate = txDate.toISOString().split("T")[0];
      const taxYear = txDate.getFullYear();

      // Backfill platform fee if not already logged
      if (!existingIds.has(piId)) {
        newExpenses.push({
          merchant_id: merchant.id,
          category: "platform_fees",
          amount: Math.round(platformFee * 100) / 100,
          description: `PawBucks Success Fee (3%) on $${stripeAmount.toFixed(2)} sale`,
          vendor_name: "PawBucks Network",
          expense_date: expenseDate,
          tax_year: taxYear,
          is_auto_logged: true,
          source_purchase_id: piId,
        });
        backfilledPlatform++;
      }

      // Backfill processing fee if not already logged
      const processingId = `${piId}_processing`;
      if (!existingIds.has(processingId)) {
        // Try to get actual fee from Stripe
        let processingFee = 0;
        try {
          const pi = await stripe.paymentIntents.retrieve(piId, {
            expand: ["latest_charge.balance_transaction"],
          }, { stripeAccount: merchant.stripe_account_id });

          const charge = pi.latest_charge;
          if (charge && typeof charge === "object" && "balance_transaction" in charge) {
            const bt = (charge as Stripe.Charge).balance_transaction;
            if (bt && typeof bt === "object") {
              const totalFee = (bt as Stripe.BalanceTransaction).fee / 100;
              processingFee = Math.max(0, totalFee - platformFee);
            }
          }
        } catch (stripeErr) {
          logStep("Stripe fee lookup failed, estimating", { piId, error: String(stripeErr) });
          processingFee = Math.round((stripeAmount * 0.029 + 0.30) * 100) / 100;
        }

        if (processingFee > 0) {
          newExpenses.push({
            merchant_id: merchant.id,
            category: "processing_fees",
            amount: Math.round(processingFee * 100) / 100,
            description: `Stripe Processing Fee on $${stripeAmount.toFixed(2)} sale`,
            vendor_name: "Stripe",
            expense_date: expenseDate,
            tax_year: taxYear,
            is_auto_logged: true,
            source_purchase_id: processingId,
          });
          backfilledProcessing++;
        }
      } else {
        skipped++;
      }
    }

    // Insert in batches of 50
    if (newExpenses.length > 0) {
      for (let i = 0; i < newExpenses.length; i += 50) {
        const batch = newExpenses.slice(i, i + 50);
        const { error: insertError } = await supabase
          .from("merchant_tax_expenses")
          .insert(batch);

        if (insertError) {
          logStep("Batch insert error", { error: insertError.message, batchStart: i });
        }
      }
    }

    logStep("Backfill complete", { backfilledPlatform, backfilledProcessing, skipped, total: newExpenses.length });

    return new Response(
      JSON.stringify({
        success: true,
        backfilledPlatform,
        backfilledProcessing,
        skipped,
        totalInserted: newExpenses.length,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    logStep("Error", { error: message });
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
