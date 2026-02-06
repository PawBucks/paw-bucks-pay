import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { z } from "https://esm.sh/zod@3.22.4";
import { Resend } from "https://esm.sh/resend@2.0.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Validation schema for market service purchase
const purchaseSchema = z.object({
  serviceId: z.string().min(1, { message: "Service ID is required" }),
  serviceName: z.string().min(1, { message: "Service name is required" }),
  priceUSD: z.number().positive({ message: "Price must be greater than 0" }),
  pricePawBucks: z.number().positive({ message: "PawBucks price must be greater than 0" }),
  payWithPawBucks: z.boolean().default(false),
  billingPeriod: z.enum(['one_time', 'one-time', 'monthly', 'quarterly', 'yearly', 'annual']).optional(),
});

const PAWBUCKS_TO_USD = 0.001;

const logStep = (step: string, details?: Record<string, unknown>) => {
  console.log(`[PURCHASE-MARKET-SERVICE] ${step}`, details ? JSON.stringify(details) : '');
};

interface MerchantInfo {
  id: string;
  business_name: string;
  business_type: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  owner_name: string | null;
}

interface ServicePurchase {
  serviceName: string;
  serviceId: string;
  priceUSD: number;
  pricePawBucks: number;
  billingPeriod: string;
  paymentMethod: string;
  amount: string;
}

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MKT-${timestamp}-${random}`;
};

const sendAdminNotification = async (merchant: MerchantInfo, purchase: ServicePurchase) => {
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
      subject: `Merchant Market Purchase Order #${orderNumber}: ${purchase.serviceName}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; border: 1px solid #e0e0e0;">
          <div style="background: linear-gradient(135deg, #7DD4D4, #5BC0C0); padding: 25px; text-align: center;">
            <h1 style="color: white; margin: 0; font-size: 28px; letter-spacing: 2px;">PAWBUCKS</h1>
            <p style="color: white; margin: 5px 0 0 0; font-size: 14px;">Merchant Market Purchase Order</p>
          </div>
          
          <div style="padding: 30px; background: #ffffff;">
            <div style="border-bottom: 2px solid #7DD4D4; padding-bottom: 15px; margin-bottom: 25px;">
              <h2 style="color: #333; margin: 0; font-size: 20px;">Purchase Order #${orderNumber}</h2>
              <p style="color: #666; margin: 5px 0 0 0; font-size: 14px;">${purchaseDate}</p>
            </div>
            
            <!-- Merchant Information Section -->
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
              <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Merchant Information</h3>
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666; width: 140px; vertical-align: top;"><strong>Business Name:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${merchant.business_name}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Business Type:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${merchant.business_type || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Owner Name:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${merchant.owner_name || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Contact Person:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${merchant.contact_person || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Email Address:</strong></td>
                  <td style="padding: 8px 0; color: #333;"><a href="mailto:${merchant.email}" style="color: #7DD4D4;">${merchant.email || 'N/A'}</a></td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Phone Number:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${merchant.phone || 'N/A'}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666; vertical-align: top;"><strong>Address:</strong></td>
                  <td style="padding: 8px 0; color: #333;">${merchant.address || 'N/A'}</td>
                </tr>
              </table>
            </div>
            
            <!-- Service Purchased Section -->
            <div style="margin-bottom: 25px;">
              <h3 style="color: #7DD4D4; margin: 0 0 15px 0; font-size: 16px; text-transform: uppercase; letter-spacing: 1px;">Service Purchased</h3>
              <table style="width: 100%; border-collapse: collapse; border: 1px solid #e0e0e0;">
                <thead>
                  <tr style="background: #f8f9fa;">
                    <th style="padding: 12px; text-align: left; border-bottom: 2px solid #7DD4D4; color: #333;">Service</th>
                    <th style="padding: 12px; text-align: center; border-bottom: 2px solid #7DD4D4; color: #333;">Billing Period</th>
                    <th style="padding: 12px; text-align: right; border-bottom: 2px solid #7DD4D4; color: #333;">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td style="padding: 15px 12px; border-bottom: 1px solid #e0e0e0;">
                      <strong style="color: #333;">${purchase.serviceName}</strong>
                      <br><span style="color: #888; font-size: 12px;">ID: ${purchase.serviceId}</span>
                    </td>
                    <td style="padding: 15px 12px; text-align: center; border-bottom: 1px solid #e0e0e0; color: #666;">${purchase.billingPeriod}</td>
                    <td style="padding: 15px 12px; text-align: right; border-bottom: 1px solid #e0e0e0;">
                      <strong style="color: #333;">${purchase.amount}</strong>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            
            <!-- Payment Summary -->
            <div style="background: #f0fafa; padding: 20px; border-radius: 8px; border-left: 4px solid #7DD4D4;">
              <table style="width: 100%; border-collapse: collapse;">
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>Payment Method:</strong></td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">${purchase.paymentMethod}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; color: #666;"><strong>USD Equivalent:</strong></td>
                  <td style="padding: 8px 0; text-align: right; color: #333;">$${purchase.priceUSD.toFixed(2)}</td>
                </tr>
                <tr style="font-size: 18px;">
                  <td style="padding: 12px 0 0 0; color: #333;"><strong>Total:</strong></td>
                  <td style="padding: 12px 0 0 0; text-align: right; color: #7DD4D4;"><strong>${purchase.amount}</strong></td>
                </tr>
              </table>
            </div>
          </div>
          
          <div style="background: #333; padding: 20px; text-align: center;">
            <p style="color: #999; font-size: 12px; margin: 0;">PawBucks Admin Notification • Merchant Market Purchase</p>
            <p style="color: #666; font-size: 11px; margin: 8px 0 0 0;">This is an automated notification. Please do not reply to this email.</p>
          </div>
        </div>
      `,
    });
    
    logStep('Admin notification email sent successfully', { orderNumber });
  } catch (emailError) {
    logStep('Warning: Failed to send admin notification email', { error: emailError instanceof Error ? emailError.message : 'Unknown error' });
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep('Function started');

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

    logStep('User authenticated', { userId: user.id });

    const requestBody = await req.json();
    const validation = purchaseSchema.safeParse(requestBody);
    
    if (!validation.success) {
      return new Response(
        JSON.stringify({ error: validation.error.errors[0]?.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      );
    }

    const { serviceId, serviceName, priceUSD, pricePawBucks, payWithPawBucks, billingPeriod } = validation.data;

    logStep('Validated request', { serviceId, priceUSD, pricePawBucks, payWithPawBucks, billingPeriod });

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch full merchant details for the email
    const { data: merchant, error: merchantError } = await supabaseAdmin
      .from('merchants')
      .select('id, business_name, business_type, contact_person, email, phone, address, owner_name')
      .eq('user_id', user.id)
      .single();

    if (merchantError || !merchant) {
      throw new Error('Only merchants can purchase market services');
    }

    logStep('Merchant verified', { merchantId: merchant.id, businessName: merchant.business_name });

    // CASE 1: Full PawBucks payment
    if (payWithPawBucks) {
      logStep('Processing full PawBucks payment', { pricePawBucks });

      const { data: wallet, error: walletError } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .select('balance')
        .eq('merchant_id', merchant.id)
        .single();

      if (walletError || !wallet) {
        throw new Error('Could not retrieve Merchant PawBucks balance');
      }

      if (wallet.balance < pricePawBucks) {
        throw new Error(`Insufficient PawBucks balance. You have ${wallet.balance.toLocaleString()} PawBucks but need ${pricePawBucks.toLocaleString()}.`);
      }

      logStep('Merchant PawBucks balance verified', { balance: wallet.balance, required: pricePawBucks });

      const newBalance = wallet.balance - pricePawBucks;
      
      const { error: updateError } = await supabaseAdmin
        .from('merchant_pawbucks_wallet')
        .update({ balance: newBalance, last_updated: new Date().toISOString() })
        .eq('merchant_id', merchant.id);

      if (updateError) {
        throw new Error('Failed to deduct PawBucks from merchant wallet');
      }

      const { error: activityError } = await supabaseAdmin.from('merchant_pawbucks_activity').insert({
        merchant_id: merchant.id,
        amount: -pricePawBucks,
        type: 'spend',
        source: 'market_service_purchase',
        description: `Purchased: ${serviceName}`,
      });

      if (activityError) {
        logStep('Warning: Failed to log PawBucks activity', { error: activityError.message });
      }

      // Normalize billing period (handle both snake_case and kebab-case, and yearly/annual)
      const normalizedPeriod = billingPeriod?.replace('_', '-').replace('yearly', 'annual');
      const expiresAt = normalizedPeriod === 'monthly' 
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        : normalizedPeriod === 'quarterly'
        ? new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString()
        : normalizedPeriod === 'annual'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString()
        : null;

      const { data: purchaseData } = await supabaseAdmin.from('merchant_service_purchases').insert({
        merchant_id: merchant.id,
        service_id: serviceId,
        amount_paid_pawbucks: pricePawBucks,
        amount_paid_usd: 0,
        status: 'active',
        expires_at: expiresAt,
      }).select('id').single();

      logStep('Full PawBucks payment completed', { pawbucksUsed: pricePawBucks, newBalance, expiresAt });

      // Auto-log expense to Tax Vault with savings tracking
      // PawBucks purchases get 25% discount, so actual paid = priceUSD equivalent
      const actualPaidUSD = pricePawBucks * 0.001; // Convert PawBucks to USD (1 PB = $0.001)
      const savingsAmount = priceUSD - actualPaidUSD; // Full USD price minus discounted amount

      await supabaseAdmin.from('merchant_tax_expenses').insert({
        merchant_id: merchant.id,
        category: 'merchant_market',
        amount: actualPaidUSD,
        original_price: priceUSD,
        savings_amount: savingsAmount > 0 ? savingsAmount : 0,
        description: `${serviceName} - Merchant Market Service${billingPeriod ? ` (${billingPeriod})` : ''}`,
        vendor_name: 'PawBucks Merchant Market',
        expense_date: new Date().toISOString().split('T')[0],
        tax_year: new Date().getFullYear(),
        is_auto_logged: true,
        source_purchase_id: purchaseData?.id || serviceId,
      });

      logStep('Tax Vault expense auto-logged', { actualPaidUSD, savingsAmount, originalPrice: priceUSD });

      // Send enhanced admin notification email
      await sendAdminNotification(merchant as MerchantInfo, {
        serviceName,
        serviceId,
        priceUSD,
        pricePawBucks,
        billingPeriod: billingPeriod || 'one-time',
        paymentMethod: 'PawBucks',
        amount: `${pricePawBucks.toLocaleString()} PawBucks`,
      });

      return new Response(
        JSON.stringify({
          success: true,
          paymentMethod: 'pawbucks_only',
          pawbucksUsed: pricePawBucks,
          serviceName,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // CASE 2: Full USD payment via Stripe
    logStep('Processing full USD payment via Stripe', { priceUSD });

    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2024-12-18.acacia',
    });

    const stripeAmountInCents = Math.round(priceUSD * 100);

    const paymentIntent = await stripe.paymentIntents.create({
      amount: stripeAmountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        service_id: serviceId,
        service_name: serviceName,
        merchant_id: merchant.id,
        user_id: user.id,
        total_price: priceUSD.toString(),
        billing_period: billingPeriod || 'one-time',
        purchase_type: 'market_service',
      },
    });

    logStep('PaymentIntent created', { 
      paymentIntentId: paymentIntent.id,
      amountUSD: priceUSD,
    });

    // NOTE: Admin notification email is sent from stripe-webhook after payment succeeds
    // This ensures emails are only sent for completed purchases, not pending checkouts

    return new Response(
      JSON.stringify({
        success: true,
        paymentMethod: 'stripe_only',
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        stripeAmount: priceUSD,
        serviceName,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );

  } catch (error: unknown) {
    console.error('Market service purchase error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Purchase failed';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});