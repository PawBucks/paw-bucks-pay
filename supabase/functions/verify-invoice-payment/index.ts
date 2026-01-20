import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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
    const { invoiceId, sessionId } = await req.json();

    if (!invoiceId) {
      return new Response(
        JSON.stringify({ error: 'Invoice ID is required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use service role to bypass RLS
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('[VERIFY_INVOICE_PAYMENT] Verifying payment for invoice:', invoiceId);

    // Fetch invoice
    const { data: invoice, error: invoiceError } = await supabaseAdmin
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
        client_email
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      console.log('[VERIFY_INVOICE_PAYMENT] Invoice not found:', invoiceError);
      return new Response(
        JSON.stringify({ error: 'Invoice not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

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
        invoice,
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