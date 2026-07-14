import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { invoiceId, sessionId, token } = await req.json();

    if (!invoiceId || (!token && !sessionId)) {
      return new Response(
        JSON.stringify({ error: 'Invoice ID and access token or session ID are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[VERIFY_INVOICE_PAYMENT] Verifying payment for invoice:', invoiceId);

    // Fetch invoice — require either matching access_token or matching Stripe session
    let invoiceQuery = supabaseAdmin
      .from('invoices')
      .select(`
        id,
        invoice_number,
        status,
        total,
        amount_paid,
        amount_due,
        merchant_id,
        client_name,
        client_email,
        access_token,
        stripe_payment_intent_id,
        stripe_checkout_session_id
      `)
      .eq('id', invoiceId);

    if (token) {
      invoiceQuery = invoiceQuery.eq('access_token', token);
    } else {
      invoiceQuery = invoiceQuery.eq('stripe_checkout_session_id', sessionId);
    }

    const { data: invoice, error: invoiceError } = await invoiceQuery.maybeSingle();

    if (invoiceError || !invoice) {
      console.log('[VERIFY_INVOICE_PAYMENT] Invoice not found or access denied');
      return new Response(
        JSON.stringify({ error: 'Invoice not found or access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Strip sensitive fields before returning
    const { access_token: _t, stripe_payment_intent_id: _pi, stripe_checkout_session_id: _cs, ...safeInvoice } = invoice as Record<string, unknown>;

    // Fetch merchant (public info only)
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name, logo_url')
      .eq('id', invoice.merchant_id)
      .single();

    // Log the verification
    console.log('[VERIFY_INVOICE_PAYMENT] Invoice verified:', {
      invoiceId,
      status: invoice.status,
      amountPaid: invoice.amount_paid,
    });

    return new Response(
      JSON.stringify({ 
        invoice: safeInvoice,
        merchant: merchant || null,
        verified: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[VERIFY_INVOICE_PAYMENT] Error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});