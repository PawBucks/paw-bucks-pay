import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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

    console.log('Fetching wallet for user:', user.id);

    // Check if user is a shared account member - if so, use owner's wallet
    const { data: sharedMembership } = await supabaseClient
      .from('shared_account_members')
      .select('owner_id')
      .eq('member_id', user.id)
      .eq('status', 'accepted')
      .maybeSingle();

    const effectiveUserId = sharedMembership?.owner_id || user.id;
    const isSharedMember = !!sharedMembership?.owner_id;

    console.log('Effective user ID for wallet:', effectiveUserId, isSharedMember ? '(shared)' : '');

    // Get wallet balance using effective user ID
    const { data: wallet, error: walletError } = await supabaseClient
      .from('wallets')
      .select('*')
      .eq('user_id', effectiveUserId)
      .single();

    if (walletError) {
      throw new Error('Failed to fetch wallet');
    }

    // Get recent wallet activity using effective user ID
    const { data: recentActivity, error: activityError } = await supabaseClient
      .from('wallet_activity')
      .select('*')
      .eq('user_id', effectiveUserId)
      .order('created_at', { ascending: false })
      .limit(10);

    if (activityError) {
      throw new Error('Failed to fetch wallet activity');
    }

    return new Response(
      JSON.stringify({
        wallet,
        recent_activity: recentActivity || [],
        is_shared_member: isSharedMember,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error fetching wallet:', error);
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
