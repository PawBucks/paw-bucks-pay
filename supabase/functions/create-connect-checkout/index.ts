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
    const { accountId, priceId, quantity, successUrl, cancelUrl, productName, pawbucksToUse: manualPawbucksToUse } = body;

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

    // STEP 6: Handle PawBucks - either manual selection or auto-redeem
    // IMPORTANT: We only CALCULATE the PawBucks to be used here, NOT deduct them
    // Actual deduction happens in stripe-webhook AFTER payment completes
    let pawbucksUsed = 0;
    let pawbucksUsdValue = 0;
    let finalStripeAmountCents = totalAmountCents;

    // Check if manual PawBucks amount was provided by user
    const hasManualPawBucks = typeof manualPawbucksToUse === 'number' && manualPawbucksToUse > 0;
    
    if (merchantAcceptsPawBucks) {
      // Get user's PawBucks balance
      const { data: pawbucksWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .single();

      const availablePawBucks = pawbucksWallet?.balance || 0;

      if (hasManualPawBucks) {
        // User explicitly chose how many PawBucks to use via the dialog
        console.log('Manual PawBucks selection:', manualPawbucksToUse);
        
        // Validate the amount doesn't exceed balance
        pawbucksUsed = Math.min(manualPawbucksToUse, availablePawBucks);
        pawbucksUsdValue = pawbucksUsed / PAWBUCKS_TO_USD;
        
        // Ensure we don't exceed the total amount
        if (pawbucksUsdValue > totalAmountDollars) {
          pawbucksUsdValue = totalAmountDollars;
          pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);
        }
        
        finalStripeAmountCents = Math.round((totalAmountDollars - pawbucksUsdValue) * 100);
        
        console.log('Manual PawBucks applied:', {
          requested: manualPawbucksToUse,
          applied: pawbucksUsed,
          usdValue: `$${pawbucksUsdValue.toFixed(2)}`,
          remainingStripe: `$${(finalStripeAmountCents / 100).toFixed(2)}`,
        });
      } else if (isRecurringPrice) {
        // For subscriptions without manual selection, check auto-redeem preference
        const { data: userProfile } = await supabaseAdmin
          .from('profiles')
          .select('auto_redeem_pawbucks')
          .eq('id', user.id)
          .single();

        if (userProfile?.auto_redeem_pawbucks && availablePawBucks > 0) {
          console.log('Auto PawBucks redemption enabled for subscription');

          // Calculate max PawBucks that can be used (in USD)
          const maxPawBucksUsd = availablePawBucks / PAWBUCKS_TO_USD;
          
          // Calculate how much to use (up to the total amount)
          pawbucksUsdValue = Math.min(maxPawBucksUsd, totalAmountDollars);
          pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);

          // Calculate remaining Stripe amount
          finalStripeAmountCents = Math.round((totalAmountDollars - pawbucksUsdValue) * 100);

          console.log('Auto PawBucks calculation (pending deduction):', {
            availablePawBucks,
            pawbucksUsed,
            pawbucksUsdValue: `$${pawbucksUsdValue.toFixed(2)}`,
            remainingStripeAmount: `$${(finalStripeAmountCents / 100).toFixed(2)}`,
          });
        }
      }
      
      if (pawbucksUsed > 0) {
        console.log(`⏳ PawBucks deduction (${pawbucksUsed}) will occur after payment completes`);
      }
    }

    // Calculate application fee based on final Stripe amount
    let applicationFeeAmount = 0;
    if (finalStripeAmountCents > 0) {
      applicationFeeAmount = Math.round(finalStripeAmountCents * PLATFORM_FEE_PERCENTAGE);
    }

    let finalAmountDollars = finalStripeAmountCents / 100;

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
    // For one-time payments: Can be fully covered by PawBucks (no Stripe checkout needed)
    // For subscriptions: Always need minimum $0.50 for Stripe to capture card for recurring billing
    const MINIMUM_STRIPE_AMOUNT_CENTS = 50; // $0.50 minimum for Stripe
    
    if (finalStripeAmountCents <= 0 && !isRecurringPrice) {
      console.log('Full amount covered by PawBucks - no Stripe checkout needed (one-time payment)');
      
      // Deduct PawBucks from user's wallet immediately for PawBucks-only payments
      if (pawbucksUsed > 0) {
        const { data: currentWallet } = await supabaseAdmin
          .from('pawbucks_wallet')
          .select('balance')
          .eq('user_id', user.id)
          .single();
        
        if (currentWallet && currentWallet.balance >= pawbucksUsed) {
          // Deduct PawBucks from user
          await supabaseAdmin
            .from('pawbucks_wallet')
            .update({ balance: currentWallet.balance - pawbucksUsed })
            .eq('user_id', user.id);
          
          // Log user's PawBucks activity (deduction)
          await supabaseAdmin
            .from('pawbucks_activity')
            .insert({
              user_id: user.id,
              type: 'redeem',
              amount: -pawbucksUsed,
              source: 'Purchase',
              partner_id: merchantId || null,
              description: `Paid ${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)}) at ${merchantName}`,
            });
          
          // Credit merchant's PawBucks wallet
          if (merchantId) {
            // Get or create merchant wallet
            let { data: merchantWallet } = await supabaseAdmin
              .from('merchant_pawbucks_wallet')
              .select('balance')
              .eq('merchant_id', merchantId)
              .single();
            
            if (!merchantWallet) {
              // Create wallet if doesn't exist
              const { data: newWallet } = await supabaseAdmin
                .from('merchant_pawbucks_wallet')
                .insert({ merchant_id: merchantId, balance: 0 })
                .select('balance')
                .single();
              merchantWallet = newWallet;
            }
            
            if (merchantWallet) {
              // Credit merchant
              await supabaseAdmin
                .from('merchant_pawbucks_wallet')
                .update({ balance: merchantWallet.balance + pawbucksUsed })
                .eq('merchant_id', merchantId);
              
              // Log merchant's PawBucks activity (credit)
              await supabaseAdmin
                .from('merchant_pawbucks_activity')
                .insert({
                  merchant_id: merchantId,
                  type: 'earn',
                  amount: pawbucksUsed,
                  source: 'Customer Payment',
                  customer_user_id: user.id,
                  description: `Received ${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)}) from customer`,
                });
              
              console.log(`✅ Credited ${pawbucksUsed} PawBucks to merchant wallet`);
            }
          }
          
          console.log(`✅ Deducted ${pawbucksUsed} PawBucks from user wallet`);
        } else {
          console.error('Insufficient PawBucks balance for purchase');
          return new Response(
            JSON.stringify({ error: 'Insufficient PawBucks balance' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
          );
        }
      }
      
      // Create a transaction record for this payment (handled as a PawBucks-only payment)
      // NO platform fee since no Stripe payment
      if (merchantId) {
        await supabaseAdmin
          .from('transactions')
          .insert({
            user_id: user.id,
            merchant_id: merchantId,
            amount: totalAmountDollars,
            stripe_amount: 0, // No Stripe payment
            pawbucks_used: pawbucksUsed, // Full amount paid with PawBucks
            application_fee: 0, // NO fee on PawBucks-only payments
            cashback_earned: 0, // No cashback on PawBucks portion
            rewards_earned: 0,
            description: `Purchase at ${merchantName} (paid with PawBucks)`,
            status: 'completed',
          });
      }

      return new Response(
        JSON.stringify({
          success: true,
          paid_with_pawbucks: true,
          pawbucks_used: pawbucksUsed,
          pawbucks_usd_value: pawbucksUsdValue,
          message: `Purchase paid with ${pawbucksUsed} PawBucks ($${pawbucksUsdValue.toFixed(2)})`,
          redirect_url: successUrl || `${req.headers.get('origin')}/checkout-success`,
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }
    
    // For subscriptions where PawBucks would cover the full amount:
    // We need a minimum Stripe charge ($0.50) to capture card for recurring billing
    // PawBucks will cover the rest, and subsequent months charge full price via card
    if (isRecurringPrice && finalStripeAmountCents < MINIMUM_STRIPE_AMOUNT_CENTS) {
      console.log('Subscription: Ensuring minimum Stripe amount for card capture');
      
      // Calculate how much PawBucks we can actually use while keeping minimum Stripe charge
      const maxPawBucksForSubscription = Math.max(0, totalAmountCents - MINIMUM_STRIPE_AMOUNT_CENTS);
      const actualPawBucksValue = maxPawBucksForSubscription / 100;
      const actualPawBucksUsed = Math.floor(actualPawBucksValue * PAWBUCKS_TO_USD);
      
      pawbucksUsed = actualPawBucksUsed;
      pawbucksUsdValue = actualPawBucksValue;
      finalStripeAmountCents = totalAmountCents - maxPawBucksForSubscription;
      finalAmountDollars = finalStripeAmountCents / 100;
      
      console.log('Adjusted PawBucks for subscription:', {
        originalPawBucks: pawbucksUsed,
        adjustedPawBucks: actualPawBucksUsed,
        stripeAmount: `$${finalAmountDollars.toFixed(2)}`,
      });
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
          // Note: on_behalf_of is NOT used with destination charges for Express accounts
          // Statement descriptor suffix adds merchant name after platform name
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

    // For subscriptions, we need a different approach since Stripe doesn't allow
    // price_data with transfer_data in subscription mode.
    // 
    // Solution: Create a one-time payment for the first discounted amount (with PawBucks applied),
    // then create the subscription separately with trial ending when the first payment covers.
    // OR: Use destination charges with on_behalf_of for proper webhook routing.
    //
    // For simplicity and to ensure webhooks come to platform (for PawBucks crediting):
    // We'll create a coupon for the PawBucks discount and apply it to the subscription.
    
    console.log('Creating subscription checkout with destination charges:', accountId);
    
    // For subscriptions with PawBucks discount, we need to handle differently
    // The subscription must be created on the platform (not connected account) for webhooks to work
    // We use on_behalf_of to show merchant branding on statements
    
    // First, we need to create a coupon if PawBucks are being used
    let couponId: string | undefined;
    
    if (pawbucksUsed > 0 && pawbucksUsdValue > 0) {
      // Create a one-time coupon for the PawBucks discount (in cents)
      const discountAmountCents = Math.round(pawbucksUsdValue * 100);
      
      try {
        const coupon = await stripe.coupons.create({
          amount_off: discountAmountCents,
          currency: 'usd',
          duration: 'once', // Only applies to first payment
          name: `PawBucks Discount - ${pawbucksUsed} PawBucks`,
          metadata: {
            pawbucks_used: pawbucksUsed.toString(),
            user_id: user.id,
          },
        });
        couponId = coupon.id;
        console.log('Created coupon for PawBucks discount:', couponId);
      } catch (couponError) {
        console.error('Error creating coupon:', couponError);
        // Continue without coupon if creation fails
      }
    }
    
    // Get or create the price on the platform account that mirrors the connected account price
    // Since we can't use the connected account's price directly with destination charges,
    // we need to create a similar price on the platform
    
    // Retrieve the connected price details
    const connectedPriceDetails = await stripe.prices.retrieve(priceId, {
      stripeAccount: accountId,
    });
    
    const connectedProduct = await stripe.products.retrieve(
      connectedPriceDetails.product as string,
      { stripeAccount: accountId }
    );
    
    // Create a platform-level product and price that mirrors the connected one
    const platformProduct = await stripe.products.create({
      name: connectedProduct.name,
      description: connectedProduct.description || `Subscription from ${merchantName}`,
      metadata: {
        connected_account_id: accountId,
        original_product_id: connectedProduct.id,
        merchant_id: merchantId || '',
      },
    });
    
    const platformPrice = await stripe.prices.create({
      product: platformProduct.id,
      unit_amount: connectedPriceDetails.unit_amount!,
      currency: connectedPriceDetails.currency,
      recurring: connectedPriceDetails.recurring ? {
        interval: connectedPriceDetails.recurring.interval,
        interval_count: connectedPriceDetails.recurring.interval_count || 1,
      } : undefined,
      metadata: {
        connected_account_id: accountId,
        original_price_id: priceId,
        merchant_id: merchantId || '',
      },
    });
    
    console.log('Created platform price for subscription:', platformPrice.id);
    
    // Create checkout session on platform with destination charges
    // Note: In subscription mode, we cannot use payment_intent_data - statement descriptor
    // must be configured at the account level or in subscription_data
    const session = await stripe.checkout.sessions.create({
      line_items: [
        {
          price: platformPrice.id,
          quantity: quantity,
        },
      ],
      mode: 'subscription',
      success_url: successUrl || `${req.headers.get('origin')}/checkout-success?session_id={CHECKOUT_SESSION_ID}&store=${accountId}`,
      cancel_url: cancelUrl || `${req.headers.get('origin')}/checkout-canceled`,
      customer_email: user.email,
      metadata,
      discounts: couponId ? [{ coupon: couponId }] : undefined,
      subscription_data: {
        application_fee_percent: PLATFORM_FEE_PERCENTAGE * 100,
        transfer_data: {
          destination: accountId,
        },
        // Note: on_behalf_of is NOT used with destination charges for Express accounts
        metadata,
        // Statement descriptor for subscription invoices - shows merchant name
        description: `${merchantName.substring(0, 22).replace(/[<>"']/g, '')} subscription`,
      },
    });

    console.log('Subscription checkout session created with destination charges:', session.id);

    // Verify session URL was returned
    if (!session.url) {
      console.error('Stripe returned session without URL:', session.id);
      throw new Error('Checkout session created but no URL returned');
    }

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