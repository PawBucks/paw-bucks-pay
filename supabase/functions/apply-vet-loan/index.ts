import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
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

    console.log('Processing loan application for user:', user.id);

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
      throw new Error('Invalid vet clinic selected');
    }

    console.log('Vet clinic verified:', vet.name);

    // Simulate credit check (for MVP)
    // In production, this would integrate with a real credit checking service
    const creditCheckPassed = Math.random() > 0.3; // 70% approval rate
    const status = creditCheckPassed ? 'approved' : 'declined';

    console.log('Credit check result:', status);

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
      throw new Error('Failed to create loan application');
    }

    console.log('Loan created:', loan.id);

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

    // If approved, initiate Stripe Connect transfer
    if (creditCheckPassed && vet.stripe_account_id) {
      try {
        const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
          apiVersion: '2025-08-27.basil',
        });

        // Create transfer to vet's account
        const transfer = await stripe.transfers.create({
          amount: Math.round(requested_amount * 100), // Convert to cents
          currency: 'usd',
          destination: vet.stripe_account_id,
          description: `Vet loan payment - ${loan.id}`,
        });

        console.log('Stripe transfer created:', transfer.id);

        // Log payment
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
        const errorMessage = stripeError instanceof Error ? stripeError.message : 'Unknown error';
        // Don't fail the whole request, but log it
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