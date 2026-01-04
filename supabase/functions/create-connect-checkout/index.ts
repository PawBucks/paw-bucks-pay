import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// PawBucks to USD conversion: 1000 PawBucks = $1 USD
const PAWBUCKS_TO_USD = 1000;

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the request
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: authHeader },
        },
      }
    );

    // Verify the user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 401,
        }
      );
    }

    // STEP 1: Validate Stripe API Key
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) {
      throw new Error('STRIPE_SECRET_KEY is not configured');
    }

    // STEP 2: Initialize Stripe
    const stripe = new Stripe(stripeKey, {
      apiVersion: '2025-08-27.basil',
    });

    // STEP 3: Parse request body
    const body = await req.json();
    const { accountId, priceId, quantity, successUrl, cancelUrl, productName } = body;

    // Validate required fields and input types
    if (!accountId || typeof accountId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'accountId is required and must be a string' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    if (!priceId || typeof priceId !== 'string') {
      return new Response(
        JSON.stringify({ error: 'priceId is required and must be a string' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }
    if (!quantity || typeof quantity !== 'number' || quantity < 1 || quantity > 100) {
      return new Response(
        JSON.stringify({ error: 'quantity must be a number between 1 and 100' }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 400,
        }
      );
    }

    console.log(`Creating checkout for connected account ${accountId}, price ${priceId}, user ${user.id}`);

    // STEP 4: Get merchant info from Supabase for rewards tracking
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const { data: merchant } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name, cashback_rate, accepts_pawbucks')
      .eq('stripe_account_id', accountId)
      .single();

    const merchantId = merchant?.id || null;
    const merchantName = merchant?.business_name || 'Merchant Store';
    const cashbackRate = merchant?.cashback_rate || 10;
    const merchantAcceptsPawBucks = merchant?.accepts_pawbucks || false;

    console.log('Merchant found:', { merchantId, merchantName, cashbackRate, merchantAcceptsPawBucks });

    // STEP 5: Calculate application fee (3% platform fee for Connect payments)
    const PLATFORM_FEE_PERCENTAGE = 0.03; // 3% fee
    
    // Get the price details from connected account to calculate the fee and determine checkout mode
    const connectedPrice = await stripe.prices.retrieve(priceId, {
      stripeAccount: accountId,
    });

    // Determine if this is a recurring price (subscription) or one-time payment
    const isRecurringPrice = connectedPrice.type === 'recurring';
    const checkoutMode = isRecurringPrice ? 'subscription' : 'payment';

    console.log(`Price type: ${connectedPrice.type}, using checkout mode: ${checkoutMode}`);

    // Calculate total amount in cents
    let totalAmountCents = 0;
    if (connectedPrice.unit_amount) {
      totalAmountCents = connectedPrice.unit_amount * quantity;
    }

    const totalAmountDollars = totalAmountCents / 100;

    // STEP 6: Check for auto PawBucks redemption for recurring subscriptions
    // IMPORTANT: We only CALCULATE the PawBucks to be used here, NOT deduct them
    // Actual deduction happens in stripe-webhook AFTER payment completes
    let pawbucksUsed = 0;
    let pawbucksUsdValue = 0;
    let finalStripeAmountCents = totalAmountCents;

    if (isRecurringPrice && merchantAcceptsPawBucks) {
      // Get user's profile to check auto_redeem_pawbucks preference
      const { data: userProfile } = await supabaseAdmin
        .from('profiles')
        .select('auto_redeem_pawbucks')
        .eq('id', user.id)
        .single();

      if (userProfile?.auto_redeem_pawbucks) {
        console.log('Auto PawBucks redemption enabled for user');

        // Get user's PawBucks balance
        const { data: pawbucksWallet } = await supabaseAdmin
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', user.id)
          .single();

        const availablePawBucks = pawbucksWallet?.balance || 0;

        if (availablePawBucks > 0) {
          // Calculate max PawBucks that can be used (in USD)
          const maxPawBucksUsd = availablePawBucks / PAWBUCKS_TO_USD;
          
          // Calculate how much to use (up to the total amount)
          pawbucksUsdValue = Math.min(maxPawBucksUsd, totalAmountDollars);
          pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);

          // Calculate remaining Stripe amount
          const remainingUsd = totalAmountDollars - pawbucksUsdValue;
          finalStripeAmountCents = Math.round(remainingUsd * 100);

          console.log('PawBucks calculation (pending deduction on payment completion):', {
            availablePawBucks,
            pawbucksUsed,
            pawbucksUsdValue: `$${pawbucksUsdValue.toFixed(2)}`,
            remainingStripeAmount: `$${(finalStripeAmountCents / 100).toFixed(2)}`,
          });

          // NOTE: PawBucks are NOT deducted here anymore!
          // They will be deducted in stripe-webhook when checkout.session.completed fires
          console.log(`⏳ PawBucks deduction (${pawbucksUsed}) will occur after payment completes`);
        }
      }
    }

    // Calculate application fee based on final Stripe amount
    let applicationFeeAmount = 0;
    if (finalStripeAmountCents > 0) {
      applicationFeeAmount = Math.round(finalStripeAmountCents * PLATFORM_FEE_PERCENTAGE);
    }

    const finalAmountDollars = finalStripeAmountCents / 100;

    // Check user's subscription tier for cashback calculation
    let userCashbackRate = 10; // Default 10x for free accounts
    
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    if (subscription?.stripe_subscription_id) {
      const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
      const productId = stripeSubscription.items.data[0]?.price?.product;
      
      if (productId === 'prod_TQyZjYzt9DwoIK') {
        userCashbackRate = 30; // PawPass+ gets 30x
      } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
        userCashbackRate = 20; // PawPass gets 20x
      }
    }

    // PawBucks earned based on remaining Stripe amount only
    const estimatedPawBucks = Math.floor(finalAmountDollars * userCashbackRate);

    console.log(`Calculated: fee=$${(applicationFeeAmount / 100).toFixed(2)}, pawBucks=${estimatedPawBucks}`);

    // STEP 7: Handle case where PawBucks covers the full amount
    if (finalStripeAmountCents <= 0) {
      console.log('Full amount covered by PawBucks - no Stripe checkout needed');
      
      // Create a transaction record for this subscription (handled as a PawBucks-only payment)
      if (merchantId) {
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: user.id,
            merchant_id: merchantId,
            amount: totalAmountDollars,
            cashback_earned: 0, // No cashback on PawBucks portion
            rewards_earned: 0,
            description: `Subscription at ${merchantName} (paid with PawBucks)`,
            status: 'completed',
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          paid_with_pawbucks: true,
          pawbucks_used: pawbucksUsed,
          pawbucks_usd_value: pawbucksUsdValue,
          message: `Subscription paid with ${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)})`,
          redirect_url: successUrl || `${req.headers.get('origin')}/checkout-success`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // STEP 8: Create Checkout Session using DESTINATION CHARGES pattern
    // This creates the payment on the PLATFORM, then transfers to connected account
    // Benefits: Webhooks come to platform, statement descriptor can be controlled
    
    const metadata = {
      connected_account_id: accountId,
      platform_fee_percentage: (PLATFORM_FEE_PERCENTAGE * 100).toString(),
      user_id: user.id,
      merchant_id: merchantId || '',
      source: 'merchant_storefront',
      product_name: productName || merchantName,
      description: `${isRecurringPrice ? 'Subscription' : 'Purchase'} from ${merchantName}`,
      original_amount_cents: totalAmountCents.toString(),
      pawbucks_used: pawbucksUsed.toString(),
      pawbucks_usd_value: pawbucksUsdValue.toFixed(2),
    };

    // For one-time payments, use destination charges
    if (!isRecurringPrice) {
      const session = await stripe.checkout.sessions.create({
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName || `Purchase from ${merchantName}`,
                description: pawbucksUsed > 0 
                  ? `Original: $${totalAmountDollars.toFixed(2)} - PawBucks: $${pawbucksUsdValue.toFixed(2)}`
                  : undefined,
              },
              unit_amount: finalStripeAmountCents,
            },
            quantity: 1,
          },
        ],
        mode: 'payment',
        success_url: successUrl || `${req.headers.get('origin')}/checkout-success?session_id={CHECKOUT_SESSION_ID}&store=${accountId}`,
        cancel_url: cancelUrl || `${req.headers.get('origin')}/checkout-canceled`,
        customer_email: user.email,
        metadata,
        payment_intent_data: {
          application_fee_amount: applicationFeeAmount,
          transfer_data: {
            destination: accountId,
          },
          // Statement descriptor shows merchant name on customer's card statement
          statement_descriptor_suffix: merchantName.substring(0, 22).replace(/[<>"']/g, ''),
          metadata,
        },
      });

      console.log('Checkout session created (destination charge):', session.id);

      return new Response(
        JSON.stringify({
          success: true,
          checkout_url: session.url,
          session_id: session.id,
          application_fee: {
            amount: applicationFeeAmount,
            percentage: PLATFORM_FEE_PERCENTAGE * 100,
            formatted: `$${(applicationFeeAmount / 100).toFixed(2)}`,
          },
          rewards: {
            cashback_rate: userCashbackRate,
            estimated_pawbucks: estimatedPawBucks,
            formatted: `+${estimatedPawBucks} PawBucks`,
          },
          pawbucks_applied: pawbucksUsed > 0 ? {
            pawbucks_used: pawbucksUsed,
            usd_value: pawbucksUsdValue,
            formatted: `${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)})`,
          } : null,
          original_amount: totalAmountDollars,
          final_stripe_amount: finalAmountDollars,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // For subscriptions, we need to use a different approach
    // Create subscription on platform with transfers to connected account
    // Statement descriptor shows merchant name on card statement (max 22 chars)
    const statementDescriptor = merchantName.substring(0, 22).replace(/[<>"'\\]/g, '');
    
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName || `Subscription from ${merchantName}`,
              description: pawbucksUsed > 0 
                ? `Original: $${totalAmountDollars.toFixed(2)} - PawBucks: $${pawbucksUsdValue.toFixed(2)}`
                : undefined,
            },
            unit_amount: finalStripeAmountCents,
            recurring: {
              interval: connectedPrice.recurring?.interval || 'month',
              interval_count: connectedPrice.recurring?.interval_count || 1,
            },
          },
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.get('origin')}/checkout-success?session_id={CHECKOUT_SESSION_ID}&store=${accountId}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/checkout-canceled`,
      customer_email: user.email,
      metadata,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_PERCENTAGE * 100,
        transfer_data: {
          destination: accountId,
        },
        metadata,
        // For subscriptions, set invoice settings for recurring statement descriptors
        description: `${merchantName} subscription`,
      },
      // Set payment intent data for the initial subscription payment
      payment_intent_data: {
        statement_descriptor_suffix: statementDescriptor,
      },
    });

    console.log('Subscription checkout session created (with transfer):', session.id);

    return new Response(
      JSON.stringify({
        success: true,
        checkout_url: session.url,
        session_id: session.id,
        application_fee: {
          amount: applicationFeeAmount,
          percentage: PLATFORM_FEE_PERCENTAGE * 100,
          formatted: `$${(applicationFeeAmount / 100).toFixed(2)}`,
        },
        rewards: {
          cashback_rate: userCashbackRate,
          estimated_pawbucks: estimatedPawBucks,
          formatted: `+${estimatedPawBucks} PawBucks`,
        },
        pawbucks_applied: pawbucksUsed > 0 ? {
          pawbucks_used: pawbucksUsed,
          usd_value: pawbucksUsdValue,
          formatted: `${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)})`,
        } : null,
        original_amount: totalAmountDollars,
        final_stripe_amount: finalAmountDollars,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error: unknown) {
    // Extract detailed error information for better debugging
    let errorMessage = 'An unexpected error occurred';
    let errorCode = 'unknown_error';
    let errorType = 'unknown';
    
    if (error instanceof Error) {
      errorMessage = error.message;
      
      // Check if it's a Stripe error with additional details
      const stripeError = error as any;
      if (stripeError.type) {
        errorType = stripeError.type;
      }
      if (stripeError.code) {
        errorCode = stripeError.code;
      }
      if (stripeError.raw?.message) {
        errorMessage = stripeError.raw.message;
      }
      
      // Log full error details server-side
      console.error('Error creating checkout session:', {
        message: errorMessage,
        type: errorType,
        code: errorCode,
        stack: error.stack,
        raw: stripeError.raw || null,
      });
    } else {
      console.error('Non-Error exception:', error);
    }
    
    // Provide user-friendly error messages based on error type
    let userMessage = errorMessage;
    if (errorCode === 'resource_missing' || errorMessage.includes('No such price')) {
      userMessage = 'This product is no longer available. Please contact the merchant.';
    } else if (errorCode === 'account_invalid' || errorMessage.includes('account')) {
      userMessage = 'The merchant\'s payment setup is incomplete. Please try again later.';
    } else if (errorMessage.includes('authentication') || errorMessage.includes('API key')) {
      userMessage = 'Payment service configuration error. Please contact support.';
    } else if (errorMessage.includes('currency') || errorMessage.includes('amount')) {
      userMessage = 'Invalid payment amount. Please try again.';
    }
    
    return new Response(
      JSON.stringify({ 
        error: userMessage,
        error_code: errorCode,
        error_type: errorType,
        success: false,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});