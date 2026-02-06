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
            <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 2px;">PAWBUCKS</h1>
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
                    <td style="padding: 15px 12px; text-align: right; border-bottom: 1px solid #e0e0e0; color: #666;">$${purchase.item.price.toFixed(2)}</td>
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

    const { itemId, quantity } = await req.json();

    if (!itemId || !quantity || quantity <= 0) {
      throw new Error('Invalid item or quantity');
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get item details
    const { data: item, error: itemError } = await supabaseAdmin
      .from('pet_store_items')
      .select('id, name, description, price, category')
      .eq('id', itemId)
      .single();

    if (itemError || !item) {
      throw new Error('Item not found');
    }

    // Get stock separately to check availability
    const { data: stockItem, error: stockError } = await supabaseAdmin
      .from('pet_store_items')
      .select('stock_quantity')
      .eq('id', itemId)
      .single();

    if (stockError || !stockItem || stockItem.stock_quantity < quantity) {
      throw new Error('Not enough stock available');
    }

    // Fetch customer profile for detailed email
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, full_name, phone, address')
      .eq('id', user.id)
      .single();

    const customerInfo: CustomerInfo = {
      id: user.id,
      email: user.email || 'Unknown',
      full_name: profile?.full_name || null,
      phone: profile?.phone || null,
      address: profile?.address || null,
    };

    const totalAmount = item.price * quantity;
    const amountInCents = totalAmount * 100;

    // Check subscription status for multiplier
    const { data: subscription } = await supabaseAdmin
      .from('subscriptions')
      .select('status')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const hasActiveSubscription = !!subscription;
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

    // Send enhanced admin notification email
    await sendAdminNotification(customerInfo, {
      item: item as ItemInfo,
      quantity,
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