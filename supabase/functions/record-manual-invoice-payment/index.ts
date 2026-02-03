import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RecordPaymentRequest {
  invoice_id: string;
  amount: number;
  payment_method: string;
  payment_date: string;
  reference_number?: string;
  notes?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    
    // Verify authenticated user (merchant)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = authHeader.replace("Bearer ", "");
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey);
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const body: RecordPaymentRequest = await req.json();
    
    const { invoice_id, amount, payment_method, payment_date, reference_number, notes } = body;

    console.log(`[record-manual-invoice-payment] Recording payment for invoice ${invoice_id}:`, { amount, payment_method });

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from("invoices")
      .select("*, merchant_id, client_email, client_name, invoice_number, total, amount_paid, amount_due")
      .eq("id", invoice_id)
      .single();

    if (invoiceError || !invoice) {
      console.error("[record-manual-invoice-payment] Invoice not found:", invoiceError);
      return new Response(
        JSON.stringify({ error: "Invoice not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify the user owns this merchant
    const { data: merchant, error: merchantError } = await supabase
      .from("merchants")
      .select("id, user_id, business_name")
      .eq("id", invoice.merchant_id)
      .single();

    if (merchantError || !merchant || merchant.user_id !== user.id) {
      console.error("[record-manual-invoice-payment] Unauthorized merchant access");
      return new Response(
        JSON.stringify({ error: "Unauthorized to record payment for this invoice" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert the payment record
    const { data: paymentRecord, error: paymentError } = await supabase
      .from("invoice_payments")
      .insert({
        invoice_id,
        amount,
        payment_method,
        payment_date,
        reference_number: reference_number || null,
        notes: notes || null,
        status: "completed",
        recorded_by: user.id,
      })
      .select()
      .single();

    if (paymentError) {
      console.error("[record-manual-invoice-payment] Failed to insert payment:", paymentError);
      return new Response(
        JSON.stringify({ error: "Failed to record payment" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[record-manual-invoice-payment] Payment recorded:`, paymentRecord.id);

    // Look up the pet owner by client_email to link the transaction
    // Try case-insensitive search first
    const { data: petOwnerProfile } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .ilike("email", invoice.client_email)
      .maybeSingle();

    let matchedUserId: string | null = null;
    
    if (petOwnerProfile) {
      matchedUserId = petOwnerProfile.id;
      console.log(`[record-manual-invoice-payment] Found pet owner: ${petOwnerProfile.id} (${petOwnerProfile.email})`);
    } else {
      console.log(`[record-manual-invoice-payment] No matching user profile found for ${invoice.client_email}`);
    }

    // ALWAYS create a transaction record for merchant dashboard visibility
    // If no user found, user_id will be null (allowed for manual payments)
    const { data: transaction, error: transactionError } = await supabase
      .from("transactions")
      .insert({
        user_id: matchedUserId, // Can be null for unregistered clients
        merchant_id: invoice.merchant_id,
        amount: amount,
        rewards_earned: 0, // NO REWARDS for off-platform payments
        cashback_earned: 0, // NO CASHBACK for off-platform payments
        description: `Invoice #${invoice.invoice_number} - ${payment_method.replace(/_/g, ' ')} payment${!matchedUserId ? ` (${invoice.client_name})` : ''}`,
        status: "completed",
        stripe_amount: 0, // No Stripe involved
        pawbucks_used: 0, // No PawBucks involved
        application_fee: 0, // No platform fee for off-platform payments
      })
      .select()
      .single();

    let transactionCreated = false;
    let transactionId: string | null = null;

    if (transactionError) {
      console.error("[record-manual-invoice-payment] Failed to create transaction:", transactionError);
      // Don't fail the payment recording, just log the issue
    } else {
      transactionCreated = true;
      transactionId = transaction.id;
      console.log(`[record-manual-invoice-payment] Transaction created: ${transaction.id} (user_id: ${matchedUserId || 'null - unregistered client'})`);
    }

    // Log activity
    await supabase.from("invoice_activity").insert({
      invoice_id,
      action: "payment_recorded",
      description: `Manual payment of $${amount.toFixed(2)} via ${payment_method.replace(/_/g, ' ')}`,
      performed_by: user.id,
      metadata: {
        payment_id: paymentRecord.id,
        transaction_id: transactionId,
        payment_method,
        reference_number,
      },
    });

    return new Response(
      JSON.stringify({
        success: true,
        payment_id: paymentRecord.id,
        transaction_id: transactionId,
        transaction_created: transactionCreated,
        message: transactionCreated 
          ? "Payment recorded and transaction created for pet owner visibility"
          : "Payment recorded (no matching pet owner profile found)",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("[record-manual-invoice-payment] Error:", errorMessage);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
