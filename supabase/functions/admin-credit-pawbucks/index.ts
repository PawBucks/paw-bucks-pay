import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Constants for validation
const MAX_CREDIT_AMOUNT_ADMIN = 250000; // Maximum 250,000 PawBucks for Admin
const MAX_CREDIT_AMOUNT_SUPERADMIN = 500000; // Maximum 500,000 PawBucks for SuperAdmin
const MIN_CREDIT_AMOUNT = 1;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with user's JWT
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization header required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify the user is authenticated
    const supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } }
    });
    
    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    
    if (userError || !user) {
      console.error('Auth error:', userError);
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use service role client for admin checks and database operations
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    // Verify user has admin or superadmin role and get the role type
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'superadmin']);

    if (roleError || !userRoles || userRoles.length === 0) {
      console.error('Admin role check failed:', roleError);
      return new Response(
        JSON.stringify({ error: 'Admin privileges required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if user is superadmin (has higher limit)
    const isSuperAdmin = userRoles.some(r => r.role === 'superadmin');
    const maxCreditAmount = isSuperAdmin ? MAX_CREDIT_AMOUNT_SUPERADMIN : MAX_CREDIT_AMOUNT_ADMIN;

    // Parse and validate request body
    const { userId, amount, reason } = await req.json();

    // Validate userId
    if (!userId || typeof userId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'Valid userId is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid userId format' }),
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

    if (amount < MIN_CREDIT_AMOUNT || amount > maxCreditAmount) {
      return new Response(
        JSON.stringify({ error: `Amount must be between ${MIN_CREDIT_AMOUNT} and ${maxCreditAmount.toLocaleString()} PawBucks` }),
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

    console.log(`Admin ${user.id} crediting ${amount} PawBucks to user ${userId}`);

    // Check if user exists and get their current wallet
    const { data: wallet, error: walletError } = await supabaseAdmin
      .from('pawbucks_wallet')
      .select('id, balance')
      .eq('user_id', userId)
      .single();

    if (walletError || !wallet) {
      console.error('Wallet not found:', walletError);
      return new Response(
        JSON.stringify({ error: 'User wallet not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const oldBalance = wallet.balance;
    const newBalance = oldBalance + amount;

    // Update wallet balance
    const { error: updateError } = await supabaseAdmin
      .from('pawbucks_wallet')
      .update({ balance: newBalance, last_updated: new Date().toISOString() })
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update wallet:', updateError);
      return new Response(
        JSON.stringify({ error: 'Failed to update wallet' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Log the activity
    const { error: activityError } = await supabaseAdmin
      .from('pawbucks_activity')
      .insert({
        user_id: userId,
        amount: amount,
        type: 'credit',
        source: 'admin_credit',
        description: reason.trim()
      });

    if (activityError) {
      console.error('Failed to log activity:', activityError);
      // Don't fail the operation, just log the error
    }

    // Log admin action for audit trail
    const { error: auditError } = await supabaseAdmin.rpc('log_admin_action', {
      _action: 'credit_pawbucks',
      _entity_type: 'pawbucks_wallet',
      _entity_id: userId,
      _changes: {
        amount,
        reason: reason.trim(),
        old_balance: oldBalance,
        new_balance: newBalance
      }
    });

    if (auditError) {
      console.error('Failed to log audit:', auditError);
      // Don't fail the operation, just log the error
    }

    console.log(`Successfully credited ${amount} PawBucks. New balance: ${newBalance}`);

    return new Response(
      JSON.stringify({
        success: true,
        newBalance,
        credited: amount
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Admin credit error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
