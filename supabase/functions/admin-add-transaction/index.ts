import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';
import Stripe from 'https://esm.sh/stripe@14.21.0';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

// PawBucks multiplier constants matching src/lib/constants.ts
const POINTS_MULTIPLIER = {
  FREE: 10,
  PAWPASS: 20,
  PAWPASS_PLUS: 30,
} as const;

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Input validation schema
const transactionSchema = z.object({
  user_id: z.string().uuid({ message: "Invalid user ID format" }),
  merchant_id: z.string().uuid({ message: "Invalid merchant ID format" }),
  amount: z.number().positive().max(100000, { message: "Amount cannot exceed $100,000" }),
  description: z.string().max(500).optional(),
  cashback_rate: z.number().min(0).max(100).optional(),
});

// Sanitize text input to prevent XSS
function sanitizeText(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove angle brackets
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim()
    .slice(0, 500); // Limit length
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      console.error('Missing authorization header');
      return new Response(
        JSON.stringify({ error: 'Authentication required' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Create client with user's auth to verify admin status
    const supabaseAuth = createClient(supabaseUrl, supabaseServiceKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser();
    if (authError || !user) {
      console.error('Authentication error:', authError);
      return new Response(
        JSON.stringify({ error: 'Authentication failed' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      );
    }

    // Verify admin role using service role client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const { data: isAdmin } = await supabase
      .rpc('has_role', { _user_id: user.id, _role: 'admin' });

    if (!isAdmin) {
      console.error('User is not an admin:', user.id);
      return new Response(
        JSON.stringify({ error: 'Insufficient permissions' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      );
    }

    // Parse and validate input
    const rawBody = await req.json();
    const validationResult = transactionSchema.safeParse(rawBody);
    
    if (!validationResult.success) {
      console.error('Validation failed:', validationResult.error.errors);
      return new Response(
        JSON.stringify({ error: 'Invalid input data' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { user_id, merchant_id, amount, description } = validationResult.data;

    // Verify merchant exists
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('id, business_name, cashback_rate, business_type')
      .eq('id', merchant_id)
      .single();

    if (merchantError || !merchant) {
      console.error('Merchant not found:', merchantError);
      return new Response(
        JSON.stringify({ error: 'Merchant not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Verify user exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, email')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      console.error('User not found:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 }
      );
    }

    // Get user's subscription tier to calculate correct PawBucks multiplier
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('status, stripe_subscription_id')
      .eq('user_id', user_id)
      .eq('status', 'active')
      .single();

    // Determine multiplier based on subscription tier
    let multiplier: number = POINTS_MULTIPLIER.FREE; // Default to free tier
    
    if (subscription?.stripe_subscription_id) {
      const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
      if (stripeKey) {
        try {
          const stripe = new Stripe(stripeKey, {
            apiVersion: '2023-10-16',
            httpClient: Stripe.createFetchHttpClient(),
          });
          
          const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
          const productId = stripeSubscription.items.data[0]?.price?.product as string;
          
          if (productId) {
            const product = await stripe.products.retrieve(productId);
            const productName = product.name?.toLowerCase() || '';
            
            if (productName.includes('plus') || productName.includes('pawpass+')) {
              multiplier = POINTS_MULTIPLIER.PAWPASS_PLUS;
              console.log(`User ${user_id} has PawPass+ subscription, using ${multiplier}x multiplier`);
            } else if (productName.includes('pawpass') || productName.includes('basic')) {
              multiplier = POINTS_MULTIPLIER.PAWPASS;
              console.log(`User ${user_id} has PawPass subscription, using ${multiplier}x multiplier`);
            }
          }
        } catch (stripeError) {
          console.error('Error fetching Stripe subscription details:', stripeError);
          multiplier = POINTS_MULTIPLIER.PAWPASS;
        }
      }
    } else if (subscription) {
      multiplier = POINTS_MULTIPLIER.PAWPASS;
    }

    console.log(`Final multiplier for user ${user_id}: ${multiplier}x`);

    // Calculate PawBucks earned
    const pawbucksEarned = Math.floor(amount * multiplier);

    console.log(`Creating transaction: user=${user_id}, merchant=${merchant_id}, amount=${amount}, pawbucks=${pawbucksEarned}`);

    // Sanitize description if provided
    const sanitizedDescription = description 
      ? sanitizeText(description)
      : `Manual transaction added by admin`;

    // Create the transaction
    const { data: transaction, error: transactionError } = await supabase
      .from('transactions')
      .insert({
        user_id,
        merchant_id,
        amount,
        cashback_earned: pawbucksEarned,
        rewards_earned: pawbucksEarned,
        description: sanitizedDescription,
        status: 'completed',
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Failed to create transaction:', transactionError);
      return new Response(
        JSON.stringify({ error: 'Unable to create transaction. Please try again.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    // Credit PawBucks to user's wallet
    const { data: pawbucksWallet } = await supabase
      .from('pawbucks_wallet')
      .select('id, balance')
      .eq('user_id', user_id)
      .single();

    if (pawbucksWallet) {
      const newBalance = (pawbucksWallet.balance || 0) + pawbucksEarned;
      
      await supabase
        .from('pawbucks_wallet')
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq('user_id', user_id);

      // Log PawBucks activity
      await supabase
        .from('pawbucks_activity')
        .insert({
          user_id,
          amount: pawbucksEarned,
          type: 'earn',
          source: 'manual_transaction',
          description: `Earned from purchase at ${merchant.business_name} (manual)`,
          transaction_id: transaction.id,
          partner_id: merchant_id,
        });

      console.log(`Credited ${pawbucksEarned} PawBucks to user ${user_id}`);
    }

    // Log admin action
    await supabase.rpc('log_admin_action', {
      _action: 'manual_transaction_created',
      _entity_type: 'transaction',
      _entity_id: transaction.id,
      _changes: {
        user_id,
        user_email: profile.email,
        merchant_id,
        merchant_name: merchant.business_name,
        amount,
        pawbucks_earned: pawbucksEarned,
      },
    });

    console.log('Transaction created successfully:', transaction.id);

    // Generate Pet Timeline moment for this transaction
    try {
      // Get user's pet (first pet for now)
      const { data: userPets } = await supabase
        .from('pet_profiles')
        .select('id, name, type')
        .eq('user_id', user_id)
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
            'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
          },
          body: JSON.stringify({
            transactionId: transaction.id,
            petId: pet.id,
            userId: user_id,
            petName: pet.name,
            petType: pet.type,
            merchantName: merchant.business_name,
            merchantCategory: merchant.business_type,
            amount,
            pawbucksEarned,
            description: sanitizedDescription,
          }),
        }).catch(err => console.error("[ADMIN-ADD-TRANSACTION] Timeline moment error:", err));

        console.log(`Timeline moment generation triggered for pet: ${pet.id}`);
      }
    } catch (timelineError) {
      // Don't fail the transaction for timeline errors
      console.error('[ADMIN-ADD-TRANSACTION] Error triggering timeline moment:', timelineError);
    }

    // Check for Guilt-Free Badges (gamification)
    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      
      fetch(`${supabaseUrl}/functions/v1/check-guilt-badges`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          "x-internal-secret": Deno.env.get("INTERNAL_TRIGGER_SECRET") ?? "",
        },
        body: JSON.stringify({
          userId: user_id,
          transactionAmount: amount,
          merchantCategory: merchant.business_type || 'other',
          transactionId: transaction.id,
        }),
      }).catch(err => console.error("[ADMIN-ADD-TRANSACTION] Badge check error:", err));

      console.log(`Badge check triggered for user: ${user_id}`);

      // Trigger loyalty milestone advancement
      fetch(`${supabaseUrl}/functions/v1/advance-loyalty-milestones`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")
          'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
        }`,
        },
        body: JSON.stringify({
          transaction_id: transaction.id,
          user_id,
          merchant_id: merchant_id,
          cash_amount: amount,
        }),
      }).catch(err => console.error("[ADMIN-ADD-TRANSACTION] Loyalty milestone error:", err));
    } catch (badgeError) {
      console.error('[ADMIN-ADD-TRANSACTION] Error triggering badge check:', badgeError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        transaction: {
          id: transaction.id,
          amount,
          pawbucks_earned: pawbucksEarned,
          merchant_name: merchant.business_name,
          user_email: profile.email,
        },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error) {
    console.error('Unexpected error:', error);
    return new Response(
      JSON.stringify({ error: 'An unexpected error occurred. Please try again.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
