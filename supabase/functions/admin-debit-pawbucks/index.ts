import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for validation
const MAX_DEBIT_AMOUNT_ADMIN = 250000;
const MAX_DEBIT_AMOUNT_SUPERADMIN = 750000;
const MIN_DEBIT_AMOUNT = 1;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token);
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin']);

    if (roleError || !userRoles || userRoles.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isSuperAdmin = userRoles.some(r => r.role === 'superadmin');
    const maxDebitAmount = isSuperAdmin ? MAX_DEBIT_AMOUNT_SUPERADMIN : MAX_DEBIT_AMOUNT_ADMIN;

    const { targetId, targetType, amount, reason } = await req.json();

    // Validate targetType
    if (!['user', 'merchant'].includes(targetType)) {
      return new Response(
        JSON.stringify({ error: 'targetType must be "user" or "merchant"' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate targetId
    if (!targetId || typeof targetId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid targetId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(targetId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid targetId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate amount
    if (typeof amount !== 'number' || !Number.isInteger(amount)) {
      return new Response(
        JSON.stringify({ error: 'Amount must be a whole number' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (amount < MIN_DEBIT_AMOUNT || amount > maxDebitAmount) {
      return new Response(
        JSON.stringify({ error: `Amount must be between ${MIN_DEBIT_AMOUNT} and ${maxDebitAmount.toLocaleString()} PawBucks` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate reason
    if (!reason || typeof reason !== 'string' || reason.trim().length < 5) {
      return new Response(
        JSON.stringify({ error: 'A valid reason (at least 5 characters) is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (reason.length > 500) {
      return new Response(
        JSON.stringify({ error: 'Reason must be less than 500 characters' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let wallet;
    let walletTable: string;
    let activityTable: string;
    let idColumn: string;

    if (targetType === 'user') {
      walletTable = 'pawbucks_wallet';
      activityTable = 'pawbucks_activity';
      idColumn = 'user_id';

      const { data, error } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('id, balance')
        .eq('user_id', targetId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'User wallet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      wallet = data;
    } else {
      walletTable = 'merchant_pawbucks_wallet';
      activityTable = 'merchant_pawbucks_activity';
      idColumn = 'merchant_id';

      const { data, error } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('id, balance')
        .eq('merchant_id', targetId)
        .single();

      if (error || !data) {
        return new Response(
          JSON.stringify({ error: 'Merchant wallet not found' }),
          { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      wallet = data;
    }

    const oldBalance = wallet.balance;
    
    // Check if there's enough balance
    if (oldBalance < amount) {
      return new Response(
        JSON.stringify({ error: `Insufficient balance. Current balance: ${oldBalance} PawBucks` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const newBalance = oldBalance - amount;

    // Update wallet balance
    const { error: updateError } = await supabaseAdmin
      .from(walletTable)
      .update({ balance: newBalance, last_updated: new Date().toISOString() })
      .eq(idColumn, targetId);

    if (updateError) {
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log activity
    if (targetType === 'user') {
      await supabaseAdmin
        .from('pawbucks_activity')
        .insert({
          user_id: targetId,
          amount: -amount,
          type: 'spend',
          source: 'admin_debit',
          description: reason.trim()
        });
    } else {
      await supabaseAdmin
        .from('merchant_pawbucks_activity')
        .insert({
          merchant_id: targetId,
          amount: -amount,
          type: 'spend',
          source: 'admin_debit',
          description: reason.trim()
        });
    }

    // Log admin action
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        admin_id: user.id,
        action: 'debit_pawbucks',
        entity_type: targetType === 'user' ? 'pawbucks_wallet' : 'merchant_pawbucks_wallet',
        entity_id: targetId,
        changes: {
          amount,
          reason: reason.trim(),
          old_balance: oldBalance,
          new_balance: newBalance,
          target_type: targetType
        }
      });

    console.log(`Successfully debited ${amount} PawBucks from ${targetType} ${targetId}. New balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        newBalance,
        debited: amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin debit error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
