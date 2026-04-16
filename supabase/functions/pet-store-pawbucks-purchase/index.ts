import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

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
    const { data: sharedMembership } = await supabaseAdmin
      .from('shared_account_members')
      .select('account_id, shared_accounts!inner(owner_id)')
      .eq('member_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const effectiveUserId = (sharedMembership as any)?.shared_accounts?.owner_id || user.id;
    logStep("Effective user", { effectiveUserId });

    // Get wallet
    const { data: wallet, error: walletErr } = await supabaseAdmin
      .from('pawbucks_wallet')
      .select('balance')
      .eq('user_id', effectiveUserId)
      .single();

    if (walletErr || !wallet) throw new Error('Wallet not found');

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

    logStep("Totals calculated", { totalPawbucksCost, totalUsdEquivalent, balance: wallet.balance });

    if (wallet.balance < totalPawbucksCost) {
      throw new Error(`Insufficient PawBucks balance. Need ${totalPawbucksCost}, have ${wallet.balance}`);
    }

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

    // Deduct wallet balance
    await supabaseAdmin.from('pawbucks_wallet')
      .update({ balance: wallet.balance - totalPawbucksCost })
      .eq('user_id', effectiveUserId);

    // Create transaction record
    const description = `Pet Store: ${itemNames.join(', ')}`;
    await supabaseAdmin.from('transactions').insert({
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
    });

    // Mark cart as converted if cartId provided
    if (cartId) {
      await supabaseAdmin.from('shopping_carts')
        .update({ status: 'converted', converted_at: new Date().toISOString() })
        .eq('id', cartId);
      
      await supabaseAdmin.from('shopping_cart_items')
        .delete()
        .eq('cart_id', cartId);
    }

    // Send receipt email
    try {
      const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
      if (RESEND_API_KEY && user.email) {
        const itemsHtml = validatedItems.map(({ dbItem, quantity }) => `
          <tr>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;">${dbItem.name}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;">${quantity}</td>
            <td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:right;">${(dbItem.price_pawbucks * quantity).toLocaleString()} PB</td>
          </tr>
        `).join('');

        const emailHtml = `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;">
            <div style="background:#0d9488;padding:24px;text-align:center;">
              <img src="https://paw-bucks-pay.lovable.app/lovable-uploads/be67ba1e-0474-4e30-8bac-0faa4b9aab5e.png" alt="PawBucks" style="height:48px;" />
            </div>
            <div style="padding:24px;background:#fff;">
              <h2 style="color:#0d9488;margin:0 0 16px;">Purchase Receipt</h2>
              <p>Thank you for your purchase!</p>
              <table style="width:100%;border-collapse:collapse;margin:16px 0;">
                <thead>
                  <tr style="background:#f9fafb;">
                    <th style="padding:8px 12px;text-align:left;">Item</th>
                    <th style="padding:8px 12px;text-align:center;">Qty</th>
                    <th style="padding:8px 12px;text-align:right;">PawBucks</th>
                  </tr>
                </thead>
                <tbody>${itemsHtml}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="2" style="padding:12px;font-weight:bold;">Total</td>
                    <td style="padding:12px;text-align:right;font-weight:bold;">${totalPawbucksCost.toLocaleString()} PB</td>
                  </tr>
                </tfoot>
              </table>
              <p style="color:#666;font-size:14px;">Payment Method: PawBucks</p>
              <p style="color:#666;font-size:14px;">USD Equivalent: $${totalUsdEquivalent.toFixed(2)}</p>
            </div>
            <div style="padding:16px;text-align:center;color:#999;font-size:12px;">
              © ${new Date().getFullYear()} PawBucks · support@pawbucks.app
            </div>
          </div>
        `;

        // Send customer receipt
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PawBucks <noreply@pawbucks.app>',
            to: [user.email],
            subject: `PawBucks Pet Store Receipt - ${itemNames.join(', ')}`,
            html: emailHtml,
          }),
        });

        // Notify support
        await fetch('https://api.resend.com/emails', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            from: 'PawBucks <noreply@pawbucks.app>',
            to: ['support@pawbucks.app'],
            subject: `[Pet Store] PawBucks Purchase by ${user.email}`,
            html: `<p><strong>${user.email}</strong> purchased: ${itemNames.join(', ')}</p>
                   <p>Total: ${totalPawbucksCost.toLocaleString()} PB ($${totalUsdEquivalent.toFixed(2)} equiv)</p>
                   <p>Payment: PawBucks only</p>`,
          }),
        });
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
