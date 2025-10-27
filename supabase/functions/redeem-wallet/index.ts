import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { z } from "https://esm.sh/zod@3.22.4";

const redeemSchema = z.object({
  amount: z.number()
    .positive({ message: "Amount must be greater than 0" })
    .max(10000, { message: "Amount cannot exceed $10,000" }),
});

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);

    if (userError || !user) {
      throw new Error('User not authenticated');
    }

    const requestBody = await req.json();
    const validationResult = redeemSchema.safeParse(requestBody);
    
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors[0]?.message || 'Invalid input';
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const { amount } = validationResult.data;

    console.log('Redeeming wallet credits:', { userId: user.id, amount });

    // Get current wallet balance
    const { data: wallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      throw new Error('Wallet not found');
    }

    // Check sufficient balance
    if (wallet.balance < amount) {
      return new Response(
        JSON.stringify({ 
          error: 'Insufficient balance',
          current_balance: wallet.balance,
          requested_amount: amount,
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        }
      );
    }

    const oldBalance = wallet.balance;
    const newBalance = oldBalance - amount;

    // Update wallet balance
    const { error: updateError } = await supabaseClient
      .from('wallets')
      .update({ 
        balance: newBalance,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      throw new Error('Failed to update wallet balance');
    }

    // Log wallet activity
    const { error: activityError } = await supabaseClient
      .from('wallet_activity')
      .insert({
        user_id: user.id,
        wallet_id: wallet.id,
        type: 'debit',
        amount: amount,
        balance_before: oldBalance,
        balance_after: newBalance,
        description: 'Redeemed credits',
      });

    if (activityError) {
      console.error('Failed to log wallet activity:', activityError);
      // Don't throw - the balance was already updated
    }

    return new Response(
      JSON.stringify({
        success: true,
        new_balance: newBalance,
        redeemed_amount: amount,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error redeeming wallet credits:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
