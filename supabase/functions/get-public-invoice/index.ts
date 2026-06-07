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
    const { invoiceId, accessToken } = await req.json();

    console.log('[GET_PUBLIC_INVOICE] Request received:', { 
      invoiceId, 
      hasToken: !!accessToken,
      tokenLength: accessToken?.length 
    });

    if (!invoiceId || !accessToken) {
      console.log('[GET_PUBLIC_INVOICE] Missing required parameters:', { invoiceId: !!invoiceId, accessToken: !!accessToken });
      return new Response(
        JSON.stringify({ error: 'Invoice ID and access token are required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    // Use service role to bypass RLS and validate access token server-side
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch invoice with access token validation
    const { data: invoice, error: invoiceError } = await supabaseAdmin
      .from('invoices')
      .select(`
        id,
        invoice_number,
        title,
        status,
        issue_date,
        due_date,
        client_name,
        client_email,
        client_phone,
        client_company,
        client_address,
        subtotal,
        discount_type,
        discount_value,
        discount_amount,
        tax_rate,
        tax_amount,
        shipping_amount,
        total,
        amount_paid,
        amount_due,
        currency,
        paid_at,
        notes,
        terms_conditions,
        footer,
        allow_partial_payments,
        allow_tips,
        accept_credit_card,
        accept_bank_transfer,
        accept_pawbucks,
        view_count,
        merchant_id,
        invoice_items (
          id,
          description,
          quantity,
          unit_price,
          subtotal,
          total
        ),
        invoice_payments (
          id,
          amount,
          payment_date,
          payment_method,
          status
        )
      `)
      .eq('id', invoiceId)
      .eq('access_token', accessToken)
      .single();

    if (invoiceError || !invoice) {
      console.log('[GET_PUBLIC_INVOICE] Invoice fetch failed:', { 
        invoiceId, 
        errorMessage: invoiceError?.message,
        errorCode: invoiceError?.code,
        hint: 'This usually means the access token does not match or invoice does not exist'
      });
      return new Response(
        JSON.stringify({ error: 'Invoice not found or access denied' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    console.log('[GET_PUBLIC_INVOICE] Invoice found:', { 
      invoiceNumber: invoice.invoice_number,
      status: invoice.status,
      merchantId: invoice.merchant_id
    });

    // Fetch merchant info (public data only) - include accepts_pawbucks for payment options
    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name, logo_url, address, phone, email, stripe_account_id, accepts_pawbucks')
      .eq('id', invoice.merchant_id)
      .single();

    // Update view count and status if first view
    const updateData: Record<string, unknown> = {
      view_count: (invoice.view_count || 0) + 1,
      viewed_at: new Date().toISOString(),
    };
    
    // Update status to 'viewed' if it's currently 'sent' (first view)
    if (invoice.status === 'sent') {
      updateData.status = 'viewed';
    }
    
    await supabaseAdmin
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId);

    // Log activity
    await supabaseAdmin
      .from('invoice_activity')
      .insert({
        invoice_id: invoiceId,
        action: 'viewed',
        description: 'Invoice viewed by client',
      });

    return new Response(
      JSON.stringify({ 
        invoice,
        merchant: merchant || null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    console.error('Error fetching public invoice:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
