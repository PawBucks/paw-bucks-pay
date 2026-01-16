import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const sendAdminNotification = async (userEmail: string, itemName: string, quantity: number, totalAmount: number) => {
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    
    await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: ["admin@pawbucks.app"],
      subject: `New Pet Store Purchase: ${itemName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background: linear-gradient(135deg, #7DD4D4, #5BC0C0); padding: 20px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 24px;">PAWBUCKS</h1>
          </div>
          <div style="padding: 30px; background: #ffffff;">
            <h2 style="color: #333; margin-bottom: 20px;">New Pet Store Purchase</h2>
            <p style="color: #666; line-height: 1.6;">A pet owner has initiated a purchase from the Pet Store:</p>
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <p style="margin: 8px 0;"><strong>Customer Email:</strong> ${userEmail}</p>
              <p style="margin: 8px 0;"><strong>Item:</strong> ${itemName}</p>
              <p style="margin: 8px 0;"><strong>Quantity:</strong> ${quantity}</p>
              <p style="margin: 8px 0;"><strong>Total Amount:</strong> $${totalAmount.toFixed(2)} USD</p>
              <p style="margin: 8px 0;"><strong>Date:</strong> ${new Date().toLocaleString()}</p>
            </div>
            <p style="color: #888; font-size: 14px;">Note: This is a payment initiation. Final confirmation depends on successful Stripe payment.</p>
          </div>
          <div style="background: #f8f9fa; padding: 15px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">PawBucks Admin Notification</p>
          </div>
        </div>
      `,
    });
    
    console.log('Admin notification email sent successfully');
  } catch (emailError) {
    console.error('Warning: Failed to send admin notification email', emailError);
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2025-08-27.basil',
    });

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

    const { itemId, quantity } = await req.json();

    if (!itemId || !quantity || quantity <= 0) {
      throw new Error('Invalid item or quantity');
    }

    // Get item details
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { data: item, error: itemError } = await supabaseAdmin
      .from('pet_store_items')
      .select('*')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      throw new Error('Item not found');
    }

    if (item.stock_quantity < quantity) {
      throw new Error('Not enough stock available');
    }

    const totalAmount = item.price * quantity;
    const amountInCents = totalAmount * 100; // Convert dollars to cents

    // Check if user has active subscription (determines multiplier)
    // Free: 10x, PawPass: 20x, PawPass+: 30x
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription;
    // Simplified: 10x for free, 20x for subscribers (actual tier check done in stripe-webhook)
    const pawbucksMultiplier = hasActiveSubscription ? 20 : 10;
    const pawbucksEarned = Math.round(totalAmount * pawbucksMultiplier);

    console.log('Creating pet store payment:', {
      itemId,
      itemName: item.name,
      quantity,
      totalAmount,
      pawbucksMultiplier,
      pawbucksEarned,
    });

    // Create a PaymentIntent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: {
        enabled: true,
      },
      metadata: {
        user_id: user.id,
        item_id: itemId,
        item_name: item.name,
        quantity: quantity.toString(),
        source: 'pet_store',
        pawbucks_earned: pawbucksEarned.toString(),
        pawbucks_multiplier: pawbucksMultiplier.toString(),
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    // Send admin notification email
    await sendAdminNotification(user.email || 'Unknown', item.name, quantity, totalAmount);

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        pawbucksEarned,
        pawbucksMultiplier,
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: unknown) {
    console.error('Error creating pet store payment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Payment processing failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});