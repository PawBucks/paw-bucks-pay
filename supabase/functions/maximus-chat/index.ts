import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) throw new Error('LOVABLE_API_KEY is not configured');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    const { messages } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error('Messages array required');

    // Fetch user account data in parallel
    const [
      profileResult,
      walletResult,
      pawbucksResult,
      recentTxResult,
      petsResult,
      recentActivityResult,
      subscriptionResult,
      petFundResult,
    ] = await Promise.all([
      supabaseClient.from('profiles').select('full_name, user_type, phone, referral_code, created_at').eq('id', user.id).single(),
      supabaseClient.from('wallets').select('balance, total_spent, rewards_points, last_updated').eq('user_id', user.id).maybeSingle(),
      supabaseClient.from('pawbucks_wallet').select('balance, last_updated').eq('user_id', user.id).maybeSingle(),
      supabaseClient.from('transactions').select('id, amount, status, description, created_at, cashback_earned, rewards_earned, merchants!transactions_merchant_id_fkey(business_name)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
      supabaseClient.from('pet_profiles').select('name, type, breed, birthday').eq('user_id', user.id),
      supabaseClient.from('wallet_activity').select('type, amount, description, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(15),
      supabaseClient.from('subscriptions').select('plan_id, status, current_period_end').eq('user_id', user.id).eq('status', 'active').maybeSingle(),
      supabaseClient.from('pet_fund_ledgers').select('total_amount, available_balance, escrow_balance, total_released').eq('user_id', user.id).maybeSingle(),
    ]);

    const profile = profileResult.data;
    const wallet = walletResult.data;
    const pawbucks = pawbucksResult.data;
    const transactions = recentTxResult.data || [];
    const pets = petsResult.data || [];
    const activity = recentActivityResult.data || [];
    const subscription = subscriptionResult.data;
    const petFund = petFundResult.data;

    const systemPrompt = `You are Maximus 🐕, a friendly, enthusiastic, and loyal AI dog assistant for PawBucks — a pet-owner financial platform. You speak with warmth and occasional dog-related expressions (like "Woof!", "Paws-itively!", "Let me sniff that out!", "Tail-wagging good news!") but you are also knowledgeable and precise with financial data. Keep responses concise and helpful. Use emojis sparingly.

Here is the current account data for the user you're helping:

**Owner Profile:**
- Name: ${profile?.full_name || 'Unknown'}
- Account type: ${profile?.user_type || 'pet_owner'}
- Member since: ${profile?.created_at ? new Date(profile.created_at).toLocaleDateString() : 'Unknown'}
- Referral code: ${profile?.referral_code || 'None'}

**Cash Wallet:**
- Balance: $${wallet?.balance?.toFixed(2) || '0.00'}
- Total spent: $${wallet?.total_spent?.toFixed(2) || '0.00'}
- Rewards points: ${wallet?.rewards_points || 0}

**PawBucks Wallet:**
- Balance: ${pawbucks?.balance || 0} PawBucks
- (100 PawBucks = $1.00)

**Pet Fund Credit:**
- Total allocated: ${petFund?.total_amount || 0} PawBucks
- Available: ${petFund?.available_balance || 0} PawBucks
- In escrow: ${petFund?.escrow_balance || 0} PawBucks
- Released so far: ${petFund?.total_released || 0} PawBucks

**Subscription:**
${subscription ? `- Plan: ${subscription.plan_id}, Status: ${subscription.status}, Renews: ${subscription.current_period_end}` : '- No active subscription'}

**Pets (${pets.length}):**
${pets.length > 0 ? pets.map(p => `- ${p.name} (${p.type}${p.breed ? ', ' + p.breed : ''}${p.birthday ? ', born ' + p.birthday : ''})`).join('\n') : '- No pets registered yet'}

**Recent Transactions (last 15):**
${transactions.length > 0 ? transactions.map(t => `- ${new Date(t.created_at).toLocaleDateString()}: $${t.amount?.toFixed(2)} at ${(t.merchants as any)?.business_name || 'Unknown'} (${t.status})${t.cashback_earned ? ' → earned ' + t.cashback_earned + ' PawBucks' : ''}`).join('\n') : '- No transactions yet'}

**Recent Wallet Activity (last 15):**
${activity.length > 0 ? activity.map(a => `- ${new Date(a.created_at).toLocaleDateString()}: ${a.type} ${a.amount} — ${a.description}`).join('\n') : '- No recent activity'}

Rules:
- Only discuss this user's data. Never fabricate numbers.
- If you don't have data to answer a question, say so honestly.
- For questions outside of account/PawBucks scope, politely redirect.
- Be brief but thorough. Use bullet points for clarity.`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Maximus is taking a nap — too many requests! Try again in a moment. 🐕💤' }), {
          status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'Maximus ran out of treats (credits). Please top up your workspace.' }), {
          status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const t = await response.text();
      console.error('AI gateway error:', response.status, t);
      return new Response(JSON.stringify({ error: 'Maximus encountered an error. Woof!' }), {
        status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, 'Content-Type': 'text/event-stream' },
    });
  } catch (error: unknown) {
    console.error('Maximus chat error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
