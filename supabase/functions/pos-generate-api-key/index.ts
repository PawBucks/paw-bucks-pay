import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Generate a cryptographically secure random API key
function generateApiKey(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  const key = 'pk_live_' + Array.from(array, b => chars[b % chars.length]).join('');
  return key;
}

// Hash the API key for secure storage
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the user
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

    const { merchantId, name } = await req.json();

    if (!merchantId) {
      throw new Error('merchantId is required');
    }

    // Use admin client to verify merchant ownership and create integration
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify user owns this merchant
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name')
      .eq('id', merchantId)
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Merchant not found or you do not have access');
    }

    // Generate the API key
    const apiKey = generateApiKey();
    const apiKeyHash = await hashApiKey(apiKey);
    const apiKeyPrefix = apiKey.substring(0, 12); // pk_live_XXXX

    // Store the hashed key
    const { data: integration, error: insertError } = await supabaseAdmin
      .from('merchant_pos_integrations')
      .insert({
        merchant_id: merchantId,
        api_key_hash: apiKeyHash,
        api_key_prefix: apiKeyPrefix,
        name: name || 'Default POS',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Insert error:', insertError);
      throw new Error('Failed to create API key');
    }

    console.log(`POS API key created for merchant ${merchant.business_name}`);

    // Return the plain-text API key ONLY ONCE - it won't be retrievable later
    return new Response(
      JSON.stringify({
        success: true,
        integration: {
          id: integration.id,
          name: integration.name,
          api_key_prefix: apiKeyPrefix,
          created_at: integration.created_at,
        },
        // IMPORTANT: This is the only time the full API key is returned
        api_key: apiKey,
        message: 'Save this API key securely. It will not be shown again.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error generating POS API key:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
