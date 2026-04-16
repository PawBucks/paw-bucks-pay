import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CustomerInfo {
  id: string;
  email: string;
  full_name: string | null;
  phone: string | null;
  address: string | null;
}

interface ItemInfo {
  id: string;
  name: string;
  description: string | null;
  price: number;
  category: string | null;
}

interface PurchaseDetails {
  item: ItemInfo;
  quantity: number;
  totalAmount: number;
  pawbucksEarned: number;
  pawbucksMultiplier: number;
}

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `PS-${timestamp}-${random}`;
};

const sendAdminNotification = async (customer: CustomerInfo, purchase: PurchaseDetails) => {
  try {
    const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
    const orderNumber = generateOrderNumber();
    const purchaseDate = new Date().toLocaleString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short'
    });
    
    await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: ["admin@pawbucks.app"],
      subject: `Pet Store Purchase Order #${orderNumber}: ${purchase.item.name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0;">
          <div style="background: linear-gradient(135deg, #7DD4D4, #5BC0C0); padding: 25px; text-align: center;">
            <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
            <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">Pet Store Purchase Order</p>
          </div>
          
          <div style="padding: 30px; background: #ffffff;">
            <div style="border-bottom: 2px solid #7DD4D4; padding-bottom: 15px; margin-bottom: 25px;">
              <h2 style="color: #333; margin: 0; font-size: 20px;">Purchase Order #${orderNumber}</h2>
              <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">${purchaseDate}</p>
              <span style="display: inline-block; background: #fff3cd; color: #856404; padding: 4px 12px; border-radius: 4px; font-size: 12px; margin-top: 10px;">⏳ Payment Pending - Stripe Checkout</span>
            </div>
            
            <!-- Customer Information Section -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Customer Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 140px; vertical-align: top;"><strong>Customer Name:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${customer.full_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Email Address:</strong></td>
                  <td style="padding: 8px 0; color: #333;"><a href="mailto:${customer.email}" style="color: #7DD4D4;">${customer.email}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Phone Number:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${customer.phone || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Address:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${customer.address || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Customer ID:</strong></td>
                  <td style="padding: 8px 0; color: #888; font-size: 12px;">${customer.id}</td>
                </tr>
              </table>
            </div>
            
            <!-- Order Details Section -->
            <div style="margin-bottom: 25px;">
              <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Order Details</h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
                <thead>
                  <tr style="background: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7DD4D4; color: #333;">Item</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #7DD4D4; color: #333;">Qty</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #7DD4D4; color: #333;">Unit Price</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #7DD4D4; color: #333;">Total</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 15px 12px; border-bottom: 1px solid #e0e0e0;">
                      <strong style="color: #333;">${purchase.item.name}</strong>
                      ${purchase.item.category ? `<br><span style="color: #888; font-size: 12px;">Category: ${purchase.item.category}</span>` : ''}
                      ${purchase.item.description ? `<br><span style="color: #666; font-size: 12px; font-style: italic;">${purchase.item.description.substring(0, 100)}${purchase.item.description.length > 100 ? '...' : ''}</span>` : ''}
                      <br><span style="color: #999; font-size: 11px;">Item ID: ${purchase.item.id}</span>
                    </td>
                    <td style="padding: 15px 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #333; font-weight: bold;">${purchase.quantity}</td>
                    <td style="padding: 15px 12px; text-align: right; border-bottom: 1px solid #e0e0e0; color: #666;">$${(purchase.item.price / 100).toFixed(2)}</td>
                    <td style="padding: 15px 12px; text-align: right; border-bottom: 1px solid #e0e0e0;">
                      <strong style="color: #333;">$${purchase.totalAmount.toFixed(2)}</strong>
                    </td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr style="background: #f8f9fa;">
                    <td colspan="3" style="padding: 12px; text-align: right; border-top: 2px solid #7DD4D4;"><strong>Subtotal:</strong></td>
                    <td style="padding: 12px; text-align: right; border-top: 2px solid #7DD4D4;"><strong>$${purchase.totalAmount.toFixed(2)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            
            <!-- Payment & Rewards Summary -->
            <div style="background: #f0fafa; padding: 20px; border-radius: 8px; border-left: 4px solid #7DD4D4;">
              <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px;">Payment & Rewards Summary</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Payment Method:</strong></td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">Stripe (Credit/Debit Card)</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>PawBucks Multiplier:</strong></td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${purchase.pawbucksMultiplier}x</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>PawBucks to be Earned:</strong></td>
                  <td style="padding: 8px 0; text-align: right; color: #7DD4D4; font-weight: bold;">🐾 ${purchase.pawbucksEarned.toLocaleString()} PawBucks</td>
                </tr>
                <tr style="border-top: 1px solid #ddd;">
                  <td style="padding: 15px 0 0 0; font-size: 18px;"><strong>Order Total:</strong></td>
                  <td style="padding: 15px 0 0 0; text-align: right; font-size: 20px; color: #7DD4D4;"><strong>$${purchase.totalAmount.toFixed(2)} USD</strong></td>
                </tr>
              </table>
            </div>
            
            <div style="margin-top: 25px; padding: 15px; background: #fff8e6; border-radius: 8px; border-left: 4px solid #ffc107;">
              <p style="margin: 0; color: #856404; font-size: 13px;">
                <strong>⚠️ Note:</strong> This purchase order is pending payment confirmation. The customer will complete checkout via Stripe. 
                PawBucks rewards will be credited upon successful payment.
              </p>
            </div>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">PawBucks Admin Notification • Pet Store Purchase</p>
            <p style="color: #666; font-size: 11px; margin: 8px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      `,
    });
    
    console.log('Admin notification email sent successfully', { orderNumber });
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
      apiVersion: '2024-12-18.acacia',
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

    const body = await req.json();
    let pawbucksAmount = parseInt(body.pawbucksAmount || '0', 10);
    const requestAutoRedeem = body.autoRedeem === true;
    
    // Support both single item (itemId, quantity) and multi-item (items array)
    const cartItems: { itemId: string; quantity: number }[] = body.items
      ? body.items
      : [{ itemId: body.itemId, quantity: body.quantity }];

    if (!cartItems.length || cartItems.some(ci => !ci.itemId || !ci.quantity || ci.quantity <= 0)) {
      throw new Error('Invalid item or quantity');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all item details and validate stock
    const itemIds = cartItems.map(ci => ci.itemId);
    const { data: dbItems, error: itemError } = await supabaseAdmin
      .from('pet_store_items')
      .select('id, name, description, price, category, stock_quantity')
      .in('id', itemIds);

    if (itemError || !dbItems || dbItems.length !== itemIds.length) {
      throw new Error('One or more items not found');
    }

    // Validate stock for all items
    for (const ci of cartItems) {
      const dbItem = dbItems.find(i => i.id === ci.itemId);
      if (!dbItem || dbItem.stock_quantity < ci.quantity) {
        throw new Error(`Not enough stock for ${dbItem?.name || ci.itemId}`);
      }
    }

    // Use first item as primary for backward compat
    const item = dbItems[0];

    // Fetch customer profile for detailed email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone')
      .eq('id', user.id)
      .single();

    const customerInfo: CustomerInfo = {
      id: user.id,
      email: user.email || 'Unknown',
      full_name: profile?.full_name || null,
      phone: profile?.phone || null,
      address: null,
    };

    // Check for active promotional discounts for this item
    let discountPercentage = 0;
    let appliedPromotionId: string | null = null;
    let userBadgePromotionId: string | null = null;

    const { data: userPromos } = await supabaseAdmin
      .from('user_badge_promotions')
      .select(`
        id,
        promotion_id,
        expires_at,
        badge_promotions:promotion_id (
          id,
          discount_percentage,
          badge_promotion_items (item_id)
        )
      `)
      .eq('user_id', user.id)
      .eq('is_used', false)
      .gt('expires_at', new Date().toISOString());

    // Find the best promotion for first item (backward compat)
    const firstItemId = cartItems[0].itemId;
    for (const up of userPromos || []) {
      const promo = up.badge_promotions as any;
      if (!promo) continue;
      
      const promoItems = promo.badge_promotion_items || [];
      const itemIncluded = promoItems.some((i: any) => i.item_id === firstItemId);
      
      if (itemIncluded && promo.discount_percentage > discountPercentage) {
        discountPercentage = promo.discount_percentage;
        appliedPromotionId = promo.id;
        userBadgePromotionId = up.id;
      }
    }

    // Calculate total price across all cart items (prices are in cents)
    let originalPriceCents = 0;
    for (const ci of cartItems) {
      const dbItem = dbItems.find(i => i.id === ci.itemId)!;
      originalPriceCents += dbItem.price * ci.quantity;
    }
    const discountAmount = discountPercentage > 0 ? Math.round(originalPriceCents * (discountPercentage / 100)) : 0;
    const totalAmountCents = originalPriceCents - discountAmount;
    let finalAmountCents = totalAmountCents;
    const totalAmount = totalAmountCents / 100; // dollars for display/emails

    // Build item names for metadata (needed early for auto-redeem descriptions)
    const allItemNames = cartItems.map(ci => {
      const dbItem = dbItems.find(i => i.id === ci.itemId)!;
      return `${dbItem.name} x${ci.quantity}`;
    }).join(', ');
    const totalQuantity = cartItems.reduce((sum, ci) => sum + ci.quantity, 0);

    // --- Auto-Redeem PawBucks Logic ---
    const PAWBUCKS_TO_USD = 1000; // 1000 PB = $1
    let pawbucksUsed = 0;
    let pawbucksUsdValue = 0;

    // Get user's PawBucks balance
    const { data: walletData } = await supabaseAdmin
      .from('pawbucks_wallets')
      .select('balance')
      .eq('user_id', user.id)
      .single();
    const availablePawBucks = walletData?.balance || 0;

    if (pawbucksAmount > 0 && availablePawBucks > 0) {
      // Manual PawBucks specified by user
      pawbucksUsed = Math.min(pawbucksAmount, availablePawBucks);
      pawbucksUsdValue = pawbucksUsed / PAWBUCKS_TO_USD;
      if (pawbucksUsdValue > totalAmount) {
        pawbucksUsdValue = totalAmount;
        pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);
      }
      finalAmountCents = Math.round((totalAmount - pawbucksUsdValue) * 100);
      console.log('PawBucks applied (manual)', { pawbucksUsed, pawbucksUsdValue, finalAmountCents });
    } else if (requestAutoRedeem && pawbucksAmount === 0 && availablePawBucks > 0) {
      // Auto-redeem: check user's profile preferences
      const { data: autoRedeemProfile } = await supabaseAdmin
        .from('profiles')
        .select('auto_redeem_mode, auto_redeem_min_coverage_pct, auto_redeem_max_apply_pct')
        .eq('id', user.id)
        .single();

      const autoRedeemMode = autoRedeemProfile?.auto_redeem_mode || 'off';
      const minCoveragePct = autoRedeemProfile?.auto_redeem_min_coverage_pct ?? 20;
      const maxApplyPct = autoRedeemProfile?.auto_redeem_max_apply_pct ?? 50;

      console.log('Auto-redeem check', { autoRedeemMode, minCoveragePct, maxApplyPct, availablePawBucks });

      let shouldAutoRedeem = false;
      let maxPawBucksToApply = availablePawBucks;

      if (autoRedeemMode === 'always') {
        shouldAutoRedeem = true;
      } else if (autoRedeemMode === 'subscriptions_only') {
        shouldAutoRedeem = false; // Pet store is not a subscription
      } else if (autoRedeemMode === 'smart') {
        const availableUsd = availablePawBucks / PAWBUCKS_TO_USD;
        const coveragePct = (availableUsd / totalAmount) * 100;
        if (coveragePct >= minCoveragePct) {
          shouldAutoRedeem = true;
          const maxUsd = totalAmount * (maxApplyPct / 100);
          maxPawBucksToApply = Math.min(availablePawBucks, Math.floor(maxUsd * PAWBUCKS_TO_USD));
        }
        console.log('Smart auto-redeem evaluation', { coveragePct: coveragePct.toFixed(1), shouldAutoRedeem });
      }

      if (shouldAutoRedeem && maxPawBucksToApply > 0) {
        pawbucksUsed = maxPawBucksToApply;
        pawbucksUsdValue = pawbucksUsed / PAWBUCKS_TO_USD;
        if (pawbucksUsdValue > totalAmount) {
          pawbucksUsdValue = totalAmount;
          pawbucksUsed = Math.floor(pawbucksUsdValue * PAWBUCKS_TO_USD);
        }
        finalAmountCents = Math.round((totalAmount - pawbucksUsdValue) * 100);
        console.log('PawBucks applied (auto-redeem)', { mode: autoRedeemMode, pawbucksUsed, pawbucksUsdValue, finalAmountCents });
      }
    }

    // If PawBucks cover the full amount, handle as full PawBucks purchase
    if (pawbucksUsed > 0 && finalAmountCents <= 0) {
      // Deduct PawBucks from wallet
      const newBalance = availablePawBucks - pawbucksUsed;
      await supabaseAdmin.from('pawbucks_wallet').update({ balance: newBalance }).eq('user_id', user.id);
      
      // Record activity
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: user.id,
        type: 'redeem',
        amount: pawbucksUsed,
        source: 'pet_store',
        description: `Purchased ${allItemNames} (auto-redeem)`,
      });

      // Decrement stock
      for (const ci of cartItems) {
        const dbItem = dbItems.find(i => i.id === ci.itemId)!;
        await supabaseAdmin.from('pet_store_items').update({ stock_quantity: dbItem.stock_quantity - ci.quantity }).eq('id', ci.itemId);
      }

      // Mark cart converted if cartId provided
      if (body.cartId) {
        await supabaseAdmin.from('shopping_carts').update({ status: 'converted', converted_at: new Date().toISOString() }).eq('id', body.cartId);
        await supabaseAdmin.from('shopping_cart_items').delete().eq('cart_id', body.cartId);
      }

      // Send notifications
      await sendAdminNotification(customerInfo, { item: item as ItemInfo, quantity: totalQuantity, totalAmount, pawbucksEarned: 0, pawbucksMultiplier: 0 });

      // Send receipt email
      try {
        const resend = new Resend(Deno.env.get("RESEND_API_KEY"));
        await resend.emails.send({
          from: "PawBucks <noreply@pawbucks.app>",
          to: [user.email || ''],
          subject: `PawBucks Pet Store Receipt - ${allItemNames}`,
          html: `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
            <h2>🐾 Purchase Confirmed!</h2>
            <p>You paid <strong>${pawbucksUsed.toLocaleString()} PawBucks</strong> ($${pawbucksUsdValue.toFixed(2)}) for <strong>${allItemNames}</strong>.</p>
            <p>Thank you for shopping at the PawBucks Pet Store!</p>
          </div>`,
        });
      } catch (e) { console.error('Receipt email failed', e); }

      // Create notification
      await supabaseAdmin.from('notifications').insert({
        user_id: user.id,
        title: 'Pet Store Purchase Complete',
        message: `You purchased ${allItemNames} using ${pawbucksUsed.toLocaleString()} PawBucks.`,
        type: 'purchase',
      });

      return new Response(JSON.stringify({
        paid_with_pawbucks: true,
        pawbucksUsed,
        pawbucksUsdValue,
        message: `Purchased with ${pawbucksUsed.toLocaleString()} PawBucks!`,
      }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 });
    }

    // If PawBucks partially cover, deduct now and charge the remainder via Stripe
    if (pawbucksUsed > 0 && finalAmountCents > 0) {
      const newBalance = availablePawBucks - pawbucksUsed;
      await supabaseAdmin.from('pawbucks_wallet').update({ balance: newBalance }).eq('user_id', user.id);
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: user.id,
        type: 'redeem',
        amount: pawbucksUsed,
        source: 'pet_store',
        description: `Applied ${pawbucksUsed.toLocaleString()} PB toward ${allItemNames}`,
      });
      console.log('PawBucks deducted for split payment', { pawbucksUsed, remainingCents: finalAmountCents });
    }

    const amountInCents = finalAmountCents;

    // Check subscription status for multiplier (3-tier: Free=10x, PawPass=20x, PawPass+=30x)
    let pawbucksMultiplier = 10;
    
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_subscription_id, subscription_tier, is_manual_upgrade, expires_at, status')
      .eq('user_id', user.id)
      .in('status', ['active', 'trialing'])
      .maybeSingle();

    // Check manual upgrade first
    if (subscription?.is_manual_upgrade && subscription?.subscription_tier) {
      const expiresAt = subscription.expires_at ? new Date(subscription.expires_at) : null;
      if (!expiresAt || expiresAt > new Date()) {
        if (subscription.subscription_tier === 'pawpass_plus') {
          pawbucksMultiplier = 30;
        } else if (subscription.subscription_tier === 'pawpass') {
          pawbucksMultiplier = 20;
        }
      }
    } else if (subscription?.stripe_subscription_id) {
      try {
        const stripeSubscription = await stripe.subscriptions.retrieve(subscription.stripe_subscription_id);
        const productId = stripeSubscription.items.data[0]?.price?.product;
        
        if (productId === 'prod_TQyZjYzt9DwoIK') {
          pawbucksMultiplier = 30; // PawPass+
        } else if (productId === 'prod_TJVK9ZhLiJnnpm') {
          pawbucksMultiplier = 20; // PawPass
        }
      } catch (e) {
        console.error('Error checking subscription tier:', e);
      }
    }
    const pawbucksEarned = Math.round(totalAmount * pawbucksMultiplier);

    console.log('Creating pet store payment:', {
      cartItems: cartItems.map(ci => ({ itemId: ci.itemId, quantity: ci.quantity })),
      originalPriceCents,
      totalAmountCents,
      totalAmountDollars: totalAmount,
      pawbucksMultiplier,
      pawbucksEarned,
    });

    // Serialize cart items for metadata (Stripe metadata values are strings, max 500 chars)
    const cartItemsJson = JSON.stringify(cartItems.map(ci => {
      const dbItem = dbItems.find(i => i.id === ci.itemId)!;
      return { id: ci.itemId, qty: ci.quantity, name: dbItem.name, priceCents: dbItem.price };
    }));

    // Create a PaymentIntent with explicit card-only for international compatibility
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method_types: ['card'],
      metadata: {
        user_id: user.id,
        item_id: firstItemId,
        item_name: allItemNames,
        quantity: totalQuantity.toString(),
        cart_items: cartItemsJson.substring(0, 500),
        source: 'pet_store',
        pawbucks_earned: pawbucksEarned.toString(),
        pawbucks_multiplier: pawbucksMultiplier.toString(),
        discount_percentage: discountPercentage.toString(),
        original_price: (originalPriceCents / 100).toString(),
        promotion_id: appliedPromotionId || '',
        user_badge_promotion_id: userBadgePromotionId || '',
        pawbucks_amount: pawbucksAmount.toString(),
      },
    });

    console.log('Payment intent created:', paymentIntent.id);

    // If a promotion was applied, mark it as used
    if (userBadgePromotionId) {
      await supabaseAdmin
        .from('user_badge_promotions')
        .update({ 
          is_used: true, 
          used_at: new Date().toISOString() 
        })
        .eq('id', userBadgePromotionId);
      
      console.log('Promotional discount applied and marked as used:', {
        promotionId: appliedPromotionId,
        discountPercentage,
        savedAmount: discountAmount,
      });
    }

    // Send enhanced admin notification email
    await sendAdminNotification(customerInfo, {
      item: item as ItemInfo,
      quantity: totalQuantity,
      totalAmount,
      pawbucksEarned,
      pawbucksMultiplier,
    });

    return new Response(
      JSON.stringify({
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        pawbucksEarned,
        pawbucksMultiplier,
        discountApplied: discountPercentage > 0,
        discountPercentage,
        originalPrice: originalPriceCents / 100,
        finalPrice: amountInCents / 100,
        cardAmount: amountInCents / 100,
        orderSummary: allItemNames,
        totalQuantity,
        pawbucksApplied: pawbucksUsed > 0 ? {
          amount: pawbucksUsed,
          usdValue: pawbucksUsdValue,
          formatted: `${pawbucksUsed.toLocaleString()} PB ($${pawbucksUsdValue.toFixed(2)})`,
        } : null,
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