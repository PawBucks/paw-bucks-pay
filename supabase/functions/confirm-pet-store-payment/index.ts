import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[CONFIRM-PET-STORE] ${step}`, details ? JSON.stringify(details) : "");
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Function started");

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('No authorization header');

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser(token);
    if (userError || !user) throw new Error('User not authenticated');

    logStep("User authenticated", { userId: user.id });

    const { paymentIntentId } = await req.json();
    if (!paymentIntentId) throw new Error('Missing paymentIntentId');

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Idempotency check
    const { data: existingTx } = await supabaseAdmin
      .from('transactions')
      .select('id')
      .eq('stripe_payment_intent_id', paymentIntentId)
      .maybeSingle();

    if (existingTx) {
      logStep("Already processed", { transactionId: existingTx.id });
      return new Response(
        JSON.stringify({ success: true, message: "Already processed", transactionId: existingTx.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Verify payment on Stripe
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId, {
      expand: ['latest_charge'],
    });

    logStep("PaymentIntent retrieved", { status: paymentIntent.status, metadata: paymentIntent.metadata });

    if (paymentIntent.status !== 'succeeded') {
      throw new Error(`Payment not succeeded. Status: ${paymentIntent.status}`);
    }

    const metadata = paymentIntent.metadata || {};
    if (metadata.source !== 'pet_store') {
      throw new Error('This payment is not a pet store purchase');
    }

    const userId = metadata.user_id;
    if (userId !== user.id) throw new Error('User ID mismatch');

    const itemId = metadata.item_id;
    const itemName = metadata.item_name || 'Pet Store Item';
    const quantity = parseInt(metadata.quantity || '1', 10);
    const pawbucksEarned = parseInt(metadata.pawbucks_earned || '0', 10);
    const pawbucksMultiplier = parseInt(metadata.pawbucks_multiplier || '10', 10);
    const amountInDollars = paymentIntent.amount / 100;

    // Get card details
    let cardBrand: string | undefined;
    let cardLast4: string | undefined;
    const latestCharge = paymentIntent.latest_charge;
    if (latestCharge && typeof latestCharge === 'object' && 'payment_method_details' in latestCharge) {
      const charge = latestCharge as Stripe.Charge;
      if (charge.payment_method_details?.card) {
        cardBrand = charge.payment_method_details.card.brand || undefined;
        cardLast4 = charge.payment_method_details.card.last4 || undefined;
      }
    }

    // Determine tier name
    let tierName = 'Free';
    if (pawbucksMultiplier >= 30) tierName = 'PawPass+';
    else if (pawbucksMultiplier >= 20) tierName = 'PawPass';

    // Get user profile
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, phone, address')
      .eq('id', user.id)
      .single();

    // Get item details
    const { data: item } = await supabaseAdmin
      .from('pet_store_items')
      .select('id, name, description, price, category, stock_quantity')
      .eq('id', itemId)
      .single();

    // 1. Deduct stock for all cart items
    let cartItemsParsed: { id: string; qty: number; name: string; priceCents: number }[] = [];
    try {
      if (metadata.cart_items) {
        cartItemsParsed = JSON.parse(metadata.cart_items);
      }
    } catch { /* fallback to single item */ }

    if (cartItemsParsed.length > 0) {
      // Multi-item cart
      for (const ci of cartItemsParsed) {
        const { data: stockItem } = await supabaseAdmin
          .from('pet_store_items')
          .select('stock_quantity')
          .eq('id', ci.id)
          .single();
        if (stockItem && stockItem.stock_quantity >= ci.qty) {
          await supabaseAdmin
            .from('pet_store_items')
            .update({ stock_quantity: stockItem.stock_quantity - ci.qty })
            .eq('id', ci.id);
          logStep("Stock deducted", { itemId: ci.id, remaining: stockItem.stock_quantity - ci.qty });
        }
      }
    } else if (item && item.stock_quantity >= quantity) {
      // Single item fallback
      await supabaseAdmin
        .from('pet_store_items')
        .update({ stock_quantity: item.stock_quantity - quantity })
        .eq('id', itemId);
      logStep("Stock deducted", { itemId, remaining: item.stock_quantity - quantity });
    }

    // 2. Create transaction record
    const pawbucksUsedInSplit = parseInt(metadata.pawbucks_amount || '0', 10);
    const paymentMethod = pawbucksUsedInSplit > 0 ? 'split' : 'card';
    
    const { data: transaction, error: txError } = await supabaseAdmin
      .from('transactions')
      .insert({
        user_id: userId,
        merchant_id: item?.merchant_id || null,
        amount: amountInDollars,
        stripe_amount: amountInDollars,
        pawbucks_used: pawbucksUsedInSplit,
        application_fee: 0,
        status: 'completed',
        payment_method: paymentMethod,
        rewards_earned: pawbucksEarned,
        cashback_earned: pawbucksEarned,
        stripe_payment_intent_id: paymentIntentId,
        description: `Pet Store: ${itemName} x${quantity}`,
      })
      .select()
      .single();

    if (txError) {
      if (txError.code === '23505') {
        const { data: dup } = await supabaseAdmin
          .from('transactions')
          .select('id')
          .eq('stripe_payment_intent_id', paymentIntentId)
          .single();
        return new Response(
          JSON.stringify({ success: true, message: "Already processed", transactionId: dup?.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      throw new Error("Failed to create transaction record");
    }

    logStep("Transaction created", { transactionId: transaction.id, paymentMethod, pawbucksUsed: pawbucksUsedInSplit });

    // 2b. Deduct PawBucks if split payment
    if (pawbucksUsedInSplit > 0) {
      const pawbucksUsdValue = pawbucksUsedInSplit * 0.001;
      
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: userId,
        amount: pawbucksUsedInSplit,
        type: 'debit',
        source: 'pet_store',
        description: `Used ${pawbucksUsedInSplit} PawBucks ($${pawbucksUsdValue.toFixed(2)}) for Pet Store purchase: ${itemName}`,
        transaction_id: transaction.id,
      });

      const { data: currentWallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (currentWallet) {
        await supabaseAdmin
          .from('pawbucks_wallet')
          .update({ balance: Math.max(currentWallet.balance - pawbucksUsedInSplit, 0) })
          .eq('user_id', userId);
        logStep("PawBucks deducted for split payment", { amount: pawbucksUsedInSplit, newBalance: currentWallet.balance - pawbucksUsedInSplit });
      }
    }

    // 3. Award PawBucks
    if (pawbucksEarned > 0) {
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: userId,
        amount: pawbucksEarned,
        type: 'earn',
        source: 'pet_store_purchase',
        description: `Earned ${pawbucksEarned} PawBucks (${tierName} ${pawbucksMultiplier}x) from Pet Store purchase: ${itemName}`,
        pawbucks_status: 'available',
        transaction_id: transaction.id,
      });

      const { data: wallet } = await supabaseAdmin
        .from('pawbucks_wallet')
        .select('balance')
        .eq('user_id', userId)
        .single();

      if (wallet) {
        await supabaseAdmin
          .from('pawbucks_wallet')
          .update({ balance: wallet.balance + pawbucksEarned })
          .eq('user_id', userId);
      } else {
        await supabaseAdmin.from('pawbucks_wallet').insert({
          user_id: userId,
          balance: pawbucksEarned,
        });
      }

      logStep("PawBucks awarded", { amount: pawbucksEarned, newBalance: (wallet?.balance || 0) + pawbucksEarned });
    }

    // 4. Get wallet balance for receipt
    const { data: updatedWallet } = await supabaseAdmin
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', userId)
      .single();

    // 5. Send customer receipt email (matching existing receipt format)
    const customerEmail = userProfile?.email || user.email;
    if (customerEmail) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL');
        const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');

        if (supabaseUrl && supabaseAnonKey) {
          await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${supabaseAnonKey}`,
            },
            body: JSON.stringify({
              email: customerEmail,
              customerName: userProfile?.full_name || undefined,
              transactionDate: new Date().toISOString(),
              receiptId: transaction.id,
              merchantName: 'PawBucks Pet Store',
              merchantDescription: 'Your one-stop shop for pet supplies, treats, and more!',
              merchantProfileUrl: 'https://pawbucks.app/pet-store',
              items: [{ name: itemName, price: amountInDollars }],
              subtotal: amountInDollars,
              pawbucksApplied: 0,
              cardAmount: amountInDollars,
              totalPaid: amountInDollars,
              cardBrand,
              cardLast4,
              pawbucksEarned,
              walletBalance: updatedWallet?.balance || 0,
              tierInfo: { tierName, multiplier: pawbucksMultiplier },
            }),
          });
          logStep("Customer receipt email sent", { email: customerEmail });
        }
      } catch (emailErr) {
        logStep("Error sending customer receipt", { error: String(emailErr) });
      }
    }

    // 6. Send notification to support@pawbucks.app
    try {
      const resendApiKey = Deno.env.get("RESEND_API_KEY");
      if (resendApiKey) {
        const { Resend } = await import("https://esm.sh/resend@2.0.0");
        const resend = new Resend(resendApiKey);

        const orderNumber = `PS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const purchaseDate = new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });

        await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: ["support@pawbucks.app"],
          subject: `✅ Pet Store Purchase Confirmed — Order #${orderNumber}: ${itemName}`,
          html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background-color:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f1f5f9;padding:32px 16px;">
<tr><td align="center">
<table width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.06);">
  <tr>
    <td style="background:linear-gradient(135deg,#0f172a 0%,#1e293b 60%,#0f172a 100%);padding:40px 24px 36px;text-align:center;">
      <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
      <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;">Pet Store Purchase — Confirmed ✔</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">Order #${orderNumber}</p>
    </td>
  </tr>

  <!-- Customer Info -->
  <tr>
    <td style="padding:24px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Customer Information</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;width:120px;">Name</td>
              <td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${userProfile?.full_name || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;">Email</td>
              <td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${customerEmail}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;">Phone</td>
              <td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${userProfile?.phone || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding:8px 0;font-size:13px;color:#64748b;">User ID</td>
              <td style="padding:8px 0;font-size:12px;color:#94a3b8;">${userId}</td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Order Details -->
  <tr>
    <td style="padding:24px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Order Details</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="padding:10px 0;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #f1f5f9;">${itemName}</td>
              <td style="padding:10px 0;font-size:14px;color:#64748b;text-align:center;border-bottom:1px solid #f1f5f9;">x${quantity}</td>
              <td style="padding:10px 0;font-size:14px;color:#1e293b;font-weight:600;text-align:right;border-bottom:1px solid #f1f5f9;">$${(item?.price ? (item.price / 100) : amountInDollars).toFixed(2)}</td>
            </tr>
            <tr>
              <td colspan="2" style="padding:12px 0;font-size:15px;font-weight:700;color:#0f172a;">Total Paid</td>
              <td style="padding:12px 0;font-size:15px;font-weight:700;color:#0f172a;text-align:right;">$${amountInDollars.toFixed(2)}</td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr>
              <td style="background:#f0fdf4;border-radius:8px;padding:8px 14px;">
                <p style="margin:0;font-size:13px;color:#16a34a;font-weight:600;">Payment: Confirmed ✔</p>
                ${cardBrand && cardLast4 ? `<p style="margin:4px 0 0;font-size:12px;color:#4ade80;">${cardBrand} ending in ${cardLast4}</p>` : ''}
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>

  <!-- Rewards -->
  <tr>
    <td style="padding:24px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:linear-gradient(135deg,#f59e0b 0%,#d97706 50%,#b45309 100%);border-radius:16px;">
        <tr>
          <td style="padding:20px;text-align:center;">
            <p style="margin:0 0 4px;font-size:11px;font-weight:600;letter-spacing:2px;color:rgba(255,255,255,0.85);text-transform:uppercase;">🐾 PawBucks Earned (${tierName} ${pawbucksMultiplier}x)</p>
            <p style="margin:0;font-size:28px;font-weight:800;color:#ffffff;">+${pawbucksEarned.toLocaleString()} PawBucks</p>
          </td>
        </tr>
      </table>
    </td>
  </tr>

  <!-- Date -->
  <tr>
    <td style="padding:24px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#94a3b8;">Purchase Date: ${purchaseDate} EST</p>
      <p style="margin:8px 0 0;font-size:12px;color:#cbd5e1;">Stripe PI: ${paymentIntentId}</p>
    </td>
  </tr>

  <!-- Footer -->
  <tr>
    <td style="padding:24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">PawBucks Admin Notification • Pet Store Purchase</p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`,
        });
        logStep("Support notification sent to support@pawbucks.app");
      }
    } catch (supportErr) {
      logStep("Error sending support notification", { error: String(supportErr) });
    }

    // 7. In-app notification for user
    await supabaseAdmin.from('notifications').insert({
      user_id: userId,
      title: '🛍️ Purchase Confirmed',
      message: `Your Pet Store order for ${itemName} ($${amountInDollars.toFixed(2)}) is confirmed. You earned ${pawbucksEarned} PawBucks!`,
      category: 'transactional',
    });

    logStep("Processing complete", { transactionId: transaction.id, pawbucksEarned });

    return new Response(
      JSON.stringify({
        success: true,
        transactionId: transaction.id,
        pawbucksEarned,
        walletBalance: updatedWallet?.balance || 0,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[CONFIRM-PET-STORE] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
