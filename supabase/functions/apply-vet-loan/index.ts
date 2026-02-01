import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[APPLY-VET-LOAN] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    logStep('User authenticated', { userId: user.id });

    // Verify PawPass subscription
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

    if (!user.email) {
      throw new Error('User email not found');
    }

    // Check for active subscription
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let hasActiveSub = false;

    if (customers.data.length > 0) {
      const customerId = customers.data[0].id;
      const subscriptions = await stripe.subscriptions.list({
        customer: customerId,
        status: 'active',
        limit: 1,
      });
      hasActiveSub = subscriptions.data.length > 0;
    }

    // Also check for manual subscriptions in database
    if (!hasActiveSub) {
      const { data: manualSub } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_manual_upgrade', true)
        .eq('status', 'active')
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      
      if (manualSub) {
        hasActiveSub = true;
      }
    }

    if (!hasActiveSub) {
      logStep('User does not have active PawPass subscription', { userId: user.id });
      throw new Error('An active subscription is required to apply for vet financing.');
    }

    logStep('PawPass subscription verified');

    const requestData = await req.json();
    const {
      vet_id,
      invoice_amount,
      requested_amount,
      term_months,
      purpose,
      invoice_url,
      agreed_to_terms
    } = requestData;

    // Validate input
    if (!vet_id || !invoice_amount || !requested_amount || !term_months) {
      throw new Error('Missing required fields');
    }

    if (!agreed_to_terms) {
      throw new Error('Must agree to terms and conditions');
    }

    if (requested_amount > invoice_amount) {
      throw new Error('Requested amount cannot exceed invoice amount');
    }

    if (![3, 6, 12].includes(term_months)) {
      throw new Error('Invalid repayment term');
    }

    // Verify vet exists
    const { data: vet, error: vetError } = await supabase
      .from('partner_vets')
      .select('*')
      .eq('id', vet_id)
      .single();

    if (vetError || !vet) {
      console.error('Vet clinic validation failed:', vet_id, vetError);
      throw new Error('Unable to process loan application. Please try again.');
    }

    logStep('Vet clinic verified', { vetName: vet.name });

    // Simulate credit check (for MVP)
    const creditCheckPassed = Math.random() > 0.3; // 70% approval rate
    const status = creditCheckPassed ? 'approved' : 'declined';

    logStep('Credit check result', { status });

    // Calculate repayment schedule
    let repayment_schedule = null;
    if (creditCheckPassed) {
      const monthly_payment = requested_amount / term_months;
      repayment_schedule = Array.from({ length: term_months }, (_, i) => ({
        month: i + 1,
        amount: parseFloat(monthly_payment.toFixed(2)),
        due_date: new Date(Date.now() + (i + 1) * 30 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'pending'
      }));
    }

    // Create loan record
    const { data: loan, error: loanError } = await supabase
      .from('vet_loans')
      .insert({
        user_id: user.id,
        vet_id,
        invoice_amount,
        requested_amount,
        term_months,
        status,
        purpose,
        invoice_url,
        repayment_schedule
      })
      .select()
      .single();

    if (loanError) {
      console.error('Error creating loan:', loanError);
      throw new Error('Unable to process loan application. Please contact support.');
    }

    logStep('Loan created', { loanId: loan.id });

    // Log activity
    await supabase
      .from('loan_activity')
      .insert({
        loan_id: loan.id,
        user_id: user.id,
        action: 'application_submitted',
        details: {
          status,
          requested_amount,
          term_months
        }
      });

    // If approved and vet has Connect account, create Direct Charge payment
    // NOTE: Vet loans are platform-funded, so we use a different approach:
    // The platform pays the vet, then collects from the user over time
    if (creditCheckPassed && vet.stripe_account_id) {
      try {
        // ============================================================
        // VET LOAN PAYOUT: Platform funds the vet directly
        // ============================================================
        // For vet loans, the platform advances the money to the vet.
        // This is NOT a customer payment, so we use a payout/transfer.
        // The platform then collects from the customer over time.
        // 
        // Note: This creates liability for the platform. In production,
        // consider using a proper lending partner or escrow service.
        // ============================================================
        
        const amountInCents = Math.round(requested_amount * 100);
        
        // Create a payout to the vet's connected account
        // This is a platform-initiated transfer, NOT a customer charge
        const transfer = await stripe.transfers.create({
          amount: amountInCents,
          currency: 'usd',
          destination: vet.stripe_account_id,
          description: `Vet loan payment - Loan ID: ${loan.id}`,
          metadata: {
            loan_id: loan.id,
            user_id: user.id,
            vet_id: vet_id,
            type: 'vet_loan_disbursement',
          },
        });

        logStep('Vet loan transfer created', { transferId: transfer.id, amount: requested_amount });

        // Update loan with transfer details
        await supabase
          .from('vet_loans')
          .update({
            stripe_transfer_id: transfer.id,
            disbursed_at: new Date().toISOString(),
          })
          .eq('id', loan.id);

        // Log payment activity
        await supabase
          .from('loan_activity')
          .insert({
            loan_id: loan.id,
            user_id: user.id,
            action: 'payment_sent_to_vet',
            details: {
              transfer_id: transfer.id,
              amount: requested_amount,
              vet_name: vet.name
            }
          });
      } catch (stripeError) {
        console.error('Stripe transfer error:', stripeError);
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Transfer failed';
        
        // Log the failure but don't fail the whole request
        await supabase
          .from('loan_activity')
          .insert({
            loan_id: loan.id,
            user_id: user.id,
            action: 'payment_failed',
            details: {
              error: errorMessage
            }
          });
        
        // Update loan status to reflect the issue
        await supabase
          .from('vet_loans')
          .update({ 
            status: 'pending_disbursement',
            notes: `Transfer failed: ${errorMessage}`
          })
          .eq('id', loan.id);
      }
    }

    // Prepare response
    let message = '';
    let next_steps = '';

    if (status === 'approved' && repayment_schedule) {
      message = 'Congratulations! Your loan has been approved.';
      next_steps = `Funds will be sent directly to ${vet.name}. Your first payment of $${repayment_schedule[0].amount} is due on ${new Date(repayment_schedule[0].due_date).toLocaleDateString()}.`;
    } else if (status === 'declined') {
      message = 'We\'re sorry, but we couldn\'t approve your loan at this time.';
      next_steps = 'Please try again later or contact support for more information.';
    } else {
      message = 'Your application is being processed.';
      next_steps = 'We will notify you once a decision has been made.';
    }

    return new Response(
      JSON.stringify({
        status,
        message,
        next_steps,
        loan_id: loan.id,
        repayment_schedule: status === 'approved' ? repayment_schedule : null
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('Error in apply-vet-loan function:', error);
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
