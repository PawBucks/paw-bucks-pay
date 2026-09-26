import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { resolveWalletUserId } from "../_shared/wallet-owner.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import {
  getSpendableSources,
  planPawBucksDebit,
  applyPawBucksDebit,
} from "../_shared/pet-fund-debit.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PB-PURCHASE] ${step}`, details ? JSON.stringify(details) : "");
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

    logStep("User authenticated", { userId: user.id, email: user.email });

    const { cartId, items } = await req.json();
    // items: Array<{ itemId: string, quantity: number }>
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('No items provided');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Resolve effective wallet user (shared accounts)
    const effectiveUserId = (await resolveWalletUserId(supabaseAdmin, user.id)) || user.id;
    logStep("Effective user", { effectiveUserId });

    // Load all spendable sources (wallet + Pet Fund + legacy welcome credit)
    const sources = await getSpendableSources(supabaseAdmin, effectiveUserId);
    const startingWalletBalance = sources.walletBalance;

    // Fetch all items from DB to verify prices and stock
    const itemIds = items.map((i: any) => i.itemId);
    const { data: dbItems, error: itemsErr } = await supabaseAdmin
      .from('pet_store_items')
      .select('id, name, price, price_pawbucks, stock_quantity, merchant_id, is_active')
      .in('id', itemIds);

    if (itemsErr || !dbItems) throw new Error('Failed to fetch items');

    const itemMap = new Map(dbItems.map(i => [i.id, i]));

    // Validate and calculate totals
    let totalPawbucksCost = 0;
    let totalUsdEquivalent = 0;
    const validatedItems: Array<{ dbItem: any; quantity: number }> = [];
    const itemNames: string[] = [];

    for (const reqItem of items) {
      const dbItem = itemMap.get(reqItem.itemId);
      if (!dbItem) throw new Error(`Item not found: ${reqItem.itemId}`);
      if (!dbItem.is_active) throw new Error(`Item not available: ${dbItem.name}`);
      if (dbItem.stock_quantity < reqItem.quantity) {
        throw new Error(`Not enough stock for ${dbItem.name} (available: ${dbItem.stock_quantity})`);
      }

      const cost = dbItem.price_pawbucks * reqItem.quantity;
      totalPawbucksCost += cost;
      totalUsdEquivalent += (dbItem.price / 100) * reqItem.quantity;
      validatedItems.push({ dbItem, quantity: reqItem.quantity });
      itemNames.push(`${dbItem.name} x${reqItem.quantity}`);
    }

    logStep("Totals calculated", { totalPawbucksCost, totalUsdEquivalent, balance: startingWalletBalance });

    // Plan debit across wallet → Pet Fund → legacy welcome credit.
    // Throws if combined eligible balance is insufficient (also enforces Pet Fund min spend).
    const debitPlan = planPawBucksDebit(sources, totalPawbucksCost, totalUsdEquivalent);
    logStep("Debit plan", { ...debitPlan });

    // Process the purchase
    for (const { dbItem, quantity } of validatedItems) {
      const cost = dbItem.price_pawbucks * quantity;

      // Create order
      const { data: order, error: orderErr } = await supabaseAdmin
        .from('pet_store_orders')
        .insert({ user_id: user.id, total_amount: cost, status: 'completed' })
        .select('id')
        .single();

      if (orderErr) throw new Error(`Failed to create order: ${orderErr.message}`);

      // Create order items
      await supabaseAdmin.from('pet_store_order_items').insert({
        order_id: order.id,
        item_id: dbItem.id,
        quantity,
        price_per_item: dbItem.price_pawbucks,
      });

      // Log PawBucks activity
      await supabaseAdmin.from('pawbucks_activity').insert({
        user_id: effectiveUserId,
        type: 'redeem',
        amount: cost,
        source: 'pet_store',
        description: `Purchased ${quantity}x ${dbItem.name}`,
      });

      // Decrement stock
      await supabaseAdmin.from('pet_store_items')
        .update({ stock_quantity: dbItem.stock_quantity - quantity })
        .eq('id', dbItem.id);
    }

    // Apply the debit across all sources
    await applyPawBucksDebit(supabaseAdmin, effectiveUserId, debitPlan, {
      merchantId: validatedItems[0]?.dbItem?.merchant_id || null,
      transactionTotalCents: Math.round(totalUsdEquivalent * 100),
    });

    // Get user profile for notifications
    const { data: userProfile } = await supabaseAdmin
      .from('profiles')
      .select('email, full_name, phone')
      .eq('id', user.id)
      .single();

    // Create transaction record
    const description = `Pet Store: ${itemNames.join(', ')}`;
    const { data: txRecord } = await supabaseAdmin.from('transactions').insert({
      user_id: user.id,
      merchant_id: validatedItems[0]?.dbItem?.merchant_id || null,
      amount: totalUsdEquivalent,
      stripe_amount: 0,
      pawbucks_used: totalPawbucksCost,
      application_fee: 0,
      status: 'completed',
      payment_method: 'pawbucks',
      rewards_earned: 0,
      cashback_earned: 0,
      description,
    }).select('id').single();

    // Track Branded PawBucks redemption (FIFO across active campaigns at this merchant)
    const storeMerchantId = validatedItems[0]?.dbItem?.merchant_id || null;
    if (storeMerchantId && totalPawbucksCost > 0 && txRecord?.id) {
      try {
        const { buildPetStoreLineItems } = await import("../_shared/branded-line-items.ts");
        const brandedLineItems = await buildPetStoreLineItems(
          supabaseAdmin,
          validatedItems.map(({ dbItem, quantity }) => ({
            id: dbItem.id,
            total_cents: Math.round(Number(dbItem.price) * quantity),
          })),
        );
        const { error: brandedRedeemErr } = await supabaseAdmin.rpc("redeem_branded_pawbucks_v2", {
          p_user_id: effectiveUserId,
          p_merchant_id: storeMerchantId,
          p_amount: totalPawbucksCost,
          p_line_items: brandedLineItems,
          p_transaction_id: txRecord.id,
          p_description: `Branded PawBucks redeemed in Pet Store`,
        });
        if (brandedRedeemErr) console.error("Branded redemption tracking failed (non-fatal):", brandedRedeemErr.message);
      } catch (e) {
        console.error("Branded redemption tracking exception (non-fatal):", (e as Error).message);
      }
    }

    // Mark cart as converted if cartId provided
    if (cartId) {
      await supabaseAdmin.from('shopping_carts')
        .update({ status: 'converted', converted_at: new Date().toISOString() })
        .eq('id', cartId);
      
      await supabaseAdmin.from('shopping_cart_items')
        .delete()
        .eq('cart_id', cartId);
    }

    // In-app notification
    const totalUsdFormatted = totalUsdEquivalent.toFixed(2);
    await supabaseAdmin.from('notifications').insert({
      user_id: user.id,
      title: '🛍️ Purchase Confirmed',
      message: `Your Pet Store order for ${itemNames.join(', ')} (${totalPawbucksCost.toLocaleString()} PawBucks / $${totalUsdFormatted}) is confirmed!`,
      category: 'transactional',
    });

    // Send receipt & admin notification emails
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY) {
        const orderNumber = `PS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
        const purchaseDate = new Date().toLocaleString('en-US', {
          timeZone: 'America/New_York',
          weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
          hour: '2-digit', minute: '2-digit',
        });
        const customerName = userProfile?.full_name || 'N/A';
        const customerEmail = userProfile?.email || user.email || 'N/A';
        const customerPhone = userProfile?.phone || 'N/A';

        const itemsHtml = validatedItems.map(({ dbItem, quantity }) => `
          <tr>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">${dbItem.name}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:center;font-size:14px;color:#64748b;">${quantity}</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;color:#1e293b;font-weight:600;">${(dbItem.price_pawbucks * quantity).toLocaleString()} PB</td>
            <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;text-align:right;font-size:14px;color:#64748b;">$${((dbItem.price / 100) * quantity).toFixed(2)}</td>
          </tr>
        `).join('');

        // Customer receipt email
        if (user.email) {
          const supabaseUrl = Deno.env.get('SUPABASE_URL');
          const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY');
          if (supabaseUrl && supabaseAnonKey) {
            await fetch(`${supabaseUrl}/functions/v1/send-receipt-email`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${supabaseAnonKey}`,
                'x-internal-secret': Deno.env.get('INTERNAL_TRIGGER_SECRET') ?? '',
              },
              body: JSON.stringify({
                email: customerEmail,
                customerName,
                transactionDate: new Date().toISOString(),
                receiptId: txRecord?.id || orderNumber,
                merchantName: 'PawBucks Pet Store',
                merchantDescription: 'Your one-stop shop for pet supplies, treats, and more!',
                merchantProfileUrl: 'https://pawbucks.app/pet-store',
                items: validatedItems.map(({ dbItem, quantity }) => ({
                  name: `${dbItem.name} x${quantity}`,
                  price: (dbItem.price / 100) * quantity,
                })),
                subtotal: totalUsdEquivalent,
                pawbucksApplied: totalPawbucksCost,
                cardAmount: 0,
                totalPaid: totalUsdEquivalent,
                pawbucksEarned: 0,
                walletBalance: Math.max(0, startingWalletBalance - (debitPlan.walletDeduction || 0)),
                tierInfo: { tierName: 'PawBucks Payment', multiplier: 0 },
              }),
            });
            logStep("Customer receipt sent", { email: customerEmail });
          }
        }

        // Admin purchase order notification to admin@pawbucks.app
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PawBucks <noreply@pawbucks.app>',
            to: ['admin@pawbucks.app'],
            subject: `Pet Store PawBucks Purchase Order #${orderNumber}: ${itemNames.join(', ')}`,
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
      <p style="margin:0 0 8px;font-size:20px;font-weight:600;color:#ffffff;">Pet Store Purchase — PawBucks Payment ✔</p>
      <p style="margin:0;font-size:13px;color:#94a3b8;">Order #${orderNumber}</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Customer Information</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b;width:120px;">Name</td><td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${customerName}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b;">Email</td><td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${customerEmail}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b;">Phone</td><td style="padding:8px 0;font-size:14px;color:#1e293b;font-weight:500;">${customerPhone}</td></tr>
            <tr><td style="padding:8px 0;font-size:13px;color:#64748b;">User ID</td><td style="padding:8px 0;font-size:12px;color:#94a3b8;">${user.id}</td></tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:24px 24px 0;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;border:1px solid #e2e8f0;">
        <tr><td style="padding:20px;">
          <p style="margin:0 0 16px;font-size:11px;font-weight:600;color:#94a3b8;text-transform:uppercase;letter-spacing:1.5px;">Order Details</p>
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr style="background:#f8fafc;">
              <th style="padding:10px 12px;text-align:left;font-size:12px;color:#64748b;">Item</th>
              <th style="padding:10px 12px;text-align:center;font-size:12px;color:#64748b;">Qty</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;">PawBucks</th>
              <th style="padding:10px 12px;text-align:right;font-size:12px;color:#64748b;">USD Equiv</th>
            </tr>
            ${itemsHtml}
            <tr>
              <td colspan="2" style="padding:12px;font-size:15px;font-weight:700;color:#0f172a;">Total</td>
              <td style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:#0f172a;">${totalPawbucksCost.toLocaleString()} PB</td>
              <td style="padding:12px;text-align:right;font-size:15px;font-weight:700;color:#0f172a;">$${totalUsdFormatted}</td>
            </tr>
          </table>
          <table cellpadding="0" cellspacing="0" style="margin-top:12px;">
            <tr><td style="background:#eff6ff;border-radius:8px;padding:8px 14px;">
              <p style="margin:0;font-size:13px;color:#2563eb;font-weight:600;">Payment: 100% PawBucks ✔</p>
            </td></tr>
          </table>
        </td></tr>
      </table>
    </td>
  </tr>
  <tr>
    <td style="padding:24px;text-align:center;">
      <p style="margin:0;font-size:13px;color:#94a3b8;">Purchase Date: ${purchaseDate} EST</p>
    </td>
  </tr>
  <tr>
    <td style="padding:24px;background:#f8fafc;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">PawBucks Admin Notification • Pet Store PawBucks Purchase</p>
      <p style="margin:0;font-size:11px;color:#cbd5e1;">© ${new Date().getFullYear()} PawBucks. All rights reserved.</p>
    </td>
  </tr>
</table>
</td></tr></table>
</body></html>`,
          }),
        });
        logStep("Admin notification sent to admin@pawbucks.app");
      }
    } catch (emailErr) {
      logStep("Email send failed (non-fatal)", { error: String(emailErr) });
    }

    logStep("Purchase completed successfully", { totalPawbucksCost });

    return new Response(
      JSON.stringify({ success: true, totalPawbucksCost, totalUsdEquivalent }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error) {
    logStep("Error", { message: error.message });
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
