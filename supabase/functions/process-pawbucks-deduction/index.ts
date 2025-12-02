import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Called by stripe webhook after successful payment to deduct PawBucks for combined payments
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, pawbucksAmount, merchantId, merchantName, paymentIntentId } = await req.json();

    if (!userId || !pawbucksAmount || pawbucksAmount <= 0) {
      return new Response(
        JSON.stringify({ success: true, message: 'No PawBucks to deduct' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      throw new Error('Could not retrieve wallet');
    }

    const newBalance = wallet.balance - pawbucksAmount;
    
    if (newBalance < 0) {
      throw new Error('Insufficient PawBucks balance');
    }

    // Update balance
    const { error: updateError } = await supabaseAdmin
      .from('pawbucks_wallet')
      .update({ balance: newBalance })
      .eq('user_id', userId);

    if (updateError) {
      throw new Error('Failed to deduct PawBucks');
    }

    // Log activity
    await supabaseAdmin.from('pawbucks_activity').insert({
      user_id: userId,
      amount: -pawbucksAmount,
      type: 'redemption',
      source: 'merchant_payment',
      description: `Payment to ${merchantName || 'merchant'}`,
      partner_id: merchantId || null,
    });

    console.log('PawBucks deducted:', { userId, pawbucksAmount, newBalance });

    return new Response(
      JSON.stringify({ success: true, newBalance }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('PawBucks deduction error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Failed to process PawBucks';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});