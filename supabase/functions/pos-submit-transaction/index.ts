import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient, SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import { z } from "https://esm.sh/zod@3.22.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-api-key',
};

// Input validation schema for POS transactions
const posTransactionSchema = z.object({
  transaction_id: z.string().max(255).optional().nullable(),
  customer_email: z.string().email().max(255).optional().nullable(),
  customer_phone: z.string().max(20).optional().nullable(),
  amount: z.number().positive().max(1000000),
  currency: z.string().length(3).default('USD'),
  items: z.array(z.object({
    name: z.string().max(255).optional(),
    quantity: z.number().positive().optional(),
    price: z.number().positive().optional(),
  })).optional().nullable(),
  timestamp: z.string().optional().nullable(),
}).refine(
  data => data.customer_email || data.customer_phone,
  { message: "Either customer_email or customer_phone is required" }
);

// Hash the API key to compare with stored hash
async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Generate HMAC signature for webhook
async function generateHmacSignature(payload: string, secret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Trigger webhooks for an event
async function triggerWebhooks(
  supabaseAdmin: SupabaseClient,
  merchantId: string,
  eventType: string,
  data: Record<string, unknown>
): Promise<void> {
  try {
    // Get active webhooks for this merchant that subscribe to this event
    const { data: webhooks, error } = await supabaseAdmin
      .from('merchant_webhooks')
      .select('*')
      .eq('merchant_id', merchantId)
      .eq('is_active', true)
      .contains('events', [eventType]);

    if (error || !webhooks || webhooks.length === 0) {
      return;
    }

    const payload = JSON.stringify({
      event: eventType,
      timestamp: new Date().toISOString(),
      data: data,
    });

    for (const webhook of webhooks) {
      const startTime = Date.now();
      let success = false;
      let responseStatus: number | null = null;
      let responseBody: string | null = null;

      try {
        const signature = await generateHmacSignature(payload, webhook.secret);
        
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Signature': signature,
            'X-Webhook-Event': eventType,
          },
          body: payload,
        });

        responseStatus = response.status;
        responseBody = await response.text().catch(() => null);
        success = response.ok;

        // Update webhook last triggered and failure count
        await supabaseAdmin
          .from('merchant_webhooks')
          .update({
            last_triggered_at: new Date().toISOString(),
            failure_count: success ? 0 : webhook.failure_count + 1,
          })
          .eq('id', webhook.id);
      } catch (err) {
        console.error(`Webhook delivery failed for ${webhook.url}:`, err);
        responseBody = err instanceof Error ? err.message : 'Unknown error';
        
        // Increment failure count
        await supabaseAdmin
          .from('merchant_webhooks')
          .update({ failure_count: webhook.failure_count + 1 })
          .eq('id', webhook.id);
      }

      // Log the delivery attempt
      await supabaseAdmin
        .from('webhook_delivery_logs')
        .insert({
          webhook_id: webhook.id,
          event_type: eventType,
          payload: data,
          response_status: responseStatus,
          response_body: responseBody?.substring(0, 1000),
          success: success,
          duration_ms: Date.now() - startTime,
        });
    }
  } catch (err) {
    console.error('Error triggering webhooks:', err);
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get API key from header
    const apiKey = req.headers.get('x-api-key');
    if (!apiKey) {
      throw new Error('API key required. Include x-api-key header.');
    }

    if (!apiKey.startsWith('pk_live_')) {
      throw new Error('Invalid API key format');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Hash the provided key and look up the integration
    const apiKeyHash = await hashApiKey(apiKey);
    
    const { data: integration, error: integrationError } = await supabaseAdmin
      .from('merchant_pos_integrations')
      .select('id, merchant_id, is_active')
      .eq('api_key_hash', apiKeyHash)
      .single();

    if (integrationError || !integration) {
      console.error('API key lookup failed:', integrationError);
      throw new Error('Invalid API key');
    }

    if (!integration.is_active) {
      throw new Error('API key is deactivated');
    }

    // Update last_used_at
    await supabaseAdmin
      .from('merchant_pos_integrations')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', integration.id);

    // Parse and validate transaction data
    const body = await req.json();
    
    // Validate input with Zod schema
    const validationResult = posTransactionSchema.safeParse(body);
    if (!validationResult.success) {
      const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
      console.error('Validation failed:', errorMessage);
      throw new Error(`Invalid request data: ${errorMessage}`);
    }
    
    const {
      transaction_id,
      customer_email,
      customer_phone,
      amount,
      currency,
      items,
      timestamp,
    } = validationResult.data;

    // Check for duplicate transaction
    if (transaction_id) {
      const { data: existing } = await supabaseAdmin
        .from('pos_transactions')
        .select('id')
        .eq('integration_id', integration.id)
        .eq('external_transaction_id', transaction_id)
        .single();

      if (existing) {
        return new Response(
          JSON.stringify({
            success: true,
            message: 'Transaction already processed',
            transaction_id: existing.id,
            duplicate: true,
          }),
          {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          }
        );
      }
    }

    // Create the POS transaction record
    const { data: posTransaction, error: insertError } = await supabaseAdmin
      .from('pos_transactions')
      .insert({
        integration_id: integration.id,
        merchant_id: integration.merchant_id,
        external_transaction_id: transaction_id || null,
        customer_email: customer_email?.toLowerCase().trim() || null,
        customer_phone: customer_phone?.replace(/\D/g, '') || null,
        amount: amount,
        currency: currency.toUpperCase(),
        items: items || null,
        pos_timestamp: timestamp ? new Date(timestamp).toISOString() : null,
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to create POS transaction:', insertError);
      throw new Error('Failed to record transaction');
    }

    // Try to match the customer to a PawBucks user
    let matchedUser = null;
    let pawbucksAwarded = 0;

    // Search by email first
    if (customer_email) {
      const { data: userByEmail } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name')
        .eq('email', customer_email.toLowerCase().trim())
        .single();
      
      if (userByEmail) {
        matchedUser = userByEmail;
      }
    }

    // If no match by email, try phone
    if (!matchedUser && customer_phone) {
      const cleanPhone = customer_phone.replace(/\D/g, '');
      const { data: userByPhone } = await supabaseAdmin
        .from('profiles')
        .select('id, email, full_name, phone')
        .eq('phone', cleanPhone)
        .single();
      
      if (userByPhone) {
        matchedUser = userByPhone;
      }
    }

    if (matchedUser) {
      // Get merchant details for cashback calculation
      const { data: merchantData } = await supabaseAdmin
        .from('merchants')
        .select('cashback_rate, business_name')
        .eq('id', integration.merchant_id)
        .single();

      const cashbackRate = merchantData?.cashback_rate || 5;
      pawbucksAwarded = Math.floor(amount * (cashbackRate / 100));

      if (pawbucksAwarded > 0) {
        // Create PawBucks activity record
        const { error: pawbucksError } = await supabaseAdmin
          .from('pawbucks_activity')
          .insert({
            user_id: matchedUser.id,
            amount: pawbucksAwarded,
            type: 'credit',
            source: 'pos_transaction',
            description: `Purchase at ${merchantData?.business_name || 'Partner Store'}`,
            partner_id: integration.merchant_id,
            pawbucks_status: 'available',
          });

        if (pawbucksError) {
          console.error('Failed to award PawBucks:', pawbucksError);
          // Don't fail the whole transaction, just log the error
          pawbucksAwarded = 0;
        }
      }

      // Update the POS transaction with matched info
      await supabaseAdmin
        .from('pos_transactions')
        .update({
          status: pawbucksAwarded > 0 ? 'rewarded' : 'matched',
          matched_user_id: matchedUser.id,
          pawbucks_awarded: pawbucksAwarded,
          processed_at: new Date().toISOString(),
        })
        .eq('id', posTransaction.id);

      console.log(`POS transaction ${posTransaction.id}: Awarded ${pawbucksAwarded} PawBucks to user ${matchedUser.id}`);
      
      // Trigger webhooks for reward.awarded event
      await triggerWebhooks(supabaseAdmin, integration.merchant_id, 'reward.awarded', {
        transaction_id: posTransaction.id,
        external_transaction_id: transaction_id,
        customer_email: customer_email,
        amount: amount,
        pawbucks_awarded: pawbucksAwarded,
      });

      // Generate Pet Timeline moment for this POS transaction
      if (pawbucksAwarded > 0) {
        try {
          // Get user's pet (first pet for now)
          const { data: userPets } = await supabaseAdmin
            .from('pet_profiles')
            .select('id, name, type')
            .eq('user_id', matchedUser.id)
            .limit(1);

          if (userPets && userPets.length > 0) {
            const pet = userPets[0];
            const supabaseUrl = Deno.env.get("SUPABASE_URL");
            
            // Trigger timeline moment generation (fire and forget)
            fetch(`${supabaseUrl}/functions/v1/generate-timeline-moment`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              },
              body: JSON.stringify({
                transactionId: posTransaction.id,
                petId: pet.id,
                userId: matchedUser.id,
                petName: pet.name,
                petType: pet.type,
                merchantName: merchantData?.business_name || 'Partner Store',
                merchantCategory: merchantData?.business_type,
                amount,
                pawbucksEarned: pawbucksAwarded,
                description: `POS purchase at ${merchantData?.business_name || 'Partner Store'}`,
              }),
            }).catch(err => console.error("[POS-SUBMIT] Timeline moment error:", err));

            console.log(`Timeline moment generation triggered for pet: ${pet.id}`);
          }
        } catch (timelineError) {
          console.error('[POS-SUBMIT] Error triggering timeline moment:', timelineError);
        }

        // Check for Guilt-Free Badges (gamification)
        try {
          const { data: merchantForBadge } = await supabaseAdmin
            .from('merchants')
            .select('business_type')
            .eq('id', integration.merchant_id)
            .single();

          fetch(`${supabaseUrl}/functions/v1/check-guilt-badges`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            },
            body: JSON.stringify({
              userId: matchedUser.id,
              transactionAmount: amount,
              merchantCategory: merchantForBadge?.business_type || 'other',
              transactionId: transaction?.id,
            }),
          }).catch(err => console.error("[POS-SUBMIT] Badge check error:", err));

          console.log(`Badge check triggered for user: ${matchedUser.id}`);
        } catch (badgeError) {
          console.error('[POS-SUBMIT] Error triggering badge check:', badgeError);
        }
      }
    } else {
      // No matching user found
      await supabaseAdmin
        .from('pos_transactions')
        .update({
          status: 'pending',
          error_message: 'No matching PawBucks user found',
        })
        .eq('id', posTransaction.id);

      console.log(`POS transaction ${posTransaction.id}: No matching user found`);
      
      // Trigger webhooks for customer.not_found event
      await triggerWebhooks(supabaseAdmin, integration.merchant_id, 'customer.not_found', {
        transaction_id: posTransaction.id,
        external_transaction_id: transaction_id,
        customer_email: customer_email,
        customer_phone: customer_phone,
        amount: amount,
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction_id: posTransaction.id,
        status: matchedUser ? (pawbucksAwarded > 0 ? 'rewarded' : 'matched') : 'pending',
        matched_user: matchedUser ? true : false,
        pawbucks_awarded: pawbucksAwarded,
        message: matchedUser
          ? `Transaction processed. ${pawbucksAwarded} PawBucks awarded.`
          : 'Transaction recorded. Customer not found in PawBucks system.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('POS transaction error:', errorMessage);
    
    return new Response(
      JSON.stringify({ error: errorMessage, success: false }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
