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
    // Create anon client for authentication verification only
    const supabaseAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser(token);

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

    // Create service role client for database operations (bypasses RLS)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get current wallet balance
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('wallets')
      .select('*')
      .eq('user_id', user.id)
      .single();

    if (walletError || !wallet) {
      console.error('Wallet lookup failed:', user.id, walletError);
      throw new Error('Unable to process redemption. Please try again.');
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

    // Update wallet balance using service role client
    const { error: updateError } = await supabaseAdmin
      .from('wallets')
      .update({ 
        balance: newBalance,
        last_updated: new Date().toISOString(),
      })
      .eq('user_id', user.id);

    if (updateError) {
      console.error('Wallet update failed:', user.id, updateError);
      throw new Error('Failed to process redemption. Please try again.');
    }

    // Log wallet activity using service role client
    const { error: activityError } = await supabaseAdmin
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

    console.log(`User ${user.id} redeemed ${amount} credits. New balance: ${newBalance}`);

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
    const errorMessage = error instanceof Error ? error.message : 'Failed to redeem credits';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
