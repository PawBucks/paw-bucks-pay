import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { Resend } from "https://esm.sh/resend@2.0.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

interface InvoicePaidNotificationParams {
  merchantEmail: string;
  merchantName: string;
  businessName?: string;
  invoiceNumber: string;
  invoiceTitle?: string;
  clientName: string;
  clientEmail: string;
  amountPaid: number;
  tipAmount?: number;
  pawbucksUsed?: number;
  paymentMethod: 'credit_card' | 'pawbucks' | 'mixed' | 'manual';
  paymentMethodDetail?: string;
  paymentDate: string;
  invoiceTotal: number;
  amountDue?: number;
  invoiceId?: string;
  merchantId?: string;
  platformFee?: number;
  pawbucksEarned?: number;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

function toSafeCurrencyAmount(amount: unknown): number {
  const numericAmount = typeof amount === 'number' ? amount : Number(amount || 0);
  if (!Number.isFinite(numericAmount)) return 0;
  return Math.max(Math.round(numericAmount * 100) / 100, 0);
}

function getPaymentDisplayAmounts(params: Pick<InvoicePaidNotificationParams, 'amountPaid' | 'tipAmount' | 'pawbucksUsed' | 'paymentMethod' | 'invoiceTotal' | 'platformFee'>) {
  const amountPaid = toSafeCurrencyAmount(params.amountPaid);
  const tipAmount = toSafeCurrencyAmount(params.tipAmount || 0);
  const pawbucksValueUSD = toSafeCurrencyAmount((params.pawbucksUsed || 0) * 0.001);
  const invoiceTotal = toSafeCurrencyAmount(params.invoiceTotal);
  const amountLooksLikeCashOnly = amountPaid + pawbucksValueUSD <= invoiceTotal + tipAmount + 0.01;

  let cashPortion = amountPaid;
  let grossReceived = amountPaid;

  if (params.paymentMethod === 'pawbucks') {
    cashPortion = 0;
    grossReceived = pawbucksValueUSD + tipAmount;
  } else if (params.paymentMethod === 'mixed') {
    cashPortion = amountLooksLikeCashOnly ? Math.max(amountPaid - tipAmount, 0) : Math.max(amountPaid - pawbucksValueUSD - tipAmount, 0);
    grossReceived = amountLooksLikeCashOnly ? amountPaid + pawbucksValueUSD : amountPaid;
  } else {
    cashPortion = Math.max(amountPaid - tipAmount, 0);
  }

  const calculatedFee = params.platformFee !== undefined
    ? toSafeCurrencyAmount(params.platformFee)
    : cashPortion > 0
      ? Math.round(cashPortion * 0.03 * 100) / 100
      : 0;

  return {
    tipAmount,
    pawbucksValueUSD,
    cashPortion: toSafeCurrencyAmount(cashPortion),
    grossReceived: toSafeCurrencyAmount(grossReceived),
    calculatedFee,
    netDeposited: toSafeCurrencyAmount(cashPortion - calculatedFee + tipAmount),
  };
}

function getPaymentMethodLabel(method: string, pawbucksUsed?: number, paymentMethodDetail?: string): string {
  if (method === 'manual' && paymentMethodDetail) {
    return paymentMethodDetail.charAt(0).toUpperCase() + paymentMethodDetail.slice(1);
  }
  if (method === 'pawbucks') return 'PawBucks';
  if (method === 'mixed' || (pawbucksUsed && pawbucksUsed > 0)) return 'Credit Card + PawBucks';
  return 'Credit Card';
}

interface DailySnapshot {
  transactions: number;
  revenue: number;
  pawbucksEarned: number;
}

async function getMerchantDailySnapshot(merchantId: string): Promise<DailySnapshot | null> {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !supabaseKey) return null;

    const supabase = createClient(supabaseUrl, supabaseKey);
    const todayStart = new Date();
    todayStart.setUTCHours(0, 0, 0, 0);

    const { data: txns } = await supabase
      .from('transactions')
      .select('amount, cashback_earned')
      .eq('merchant_id', merchantId)
      .eq('status', 'completed')
      .gte('created_at', todayStart.toISOString());

    if (!txns || txns.length === 0) return { transactions: 1, revenue: 0, pawbucksEarned: 0 };

    return {
      transactions: txns.length,
      revenue: txns.reduce((s, t) => s + (t.amount || 0), 0),
      pawbucksEarned: txns.reduce((s, t) => s + (t.cashback_earned || 0), 0),
    };
  } catch {
    return null;
  }
}

function generateInvoicePaidEmailHtml(
  params: InvoicePaidNotificationParams,
  snapshot: DailySnapshot | null
): string {
  const {
    merchantName,
    businessName,
    invoiceNumber,
    invoiceTitle,
    clientName,
    clientEmail,
    amountPaid,
    tipAmount = 0,
    pawbucksUsed = 0,
    paymentMethod,
    paymentMethodDetail,
    paymentDate,
    invoiceTotal,
    amountDue = 0,
    platformFee,
    pawbucksEarned = 0,
  } = params;

  const formattedDate = formatDate(paymentDate);
  const displayName = businessName || merchantName;
  const isManualPayment = paymentMethod === 'manual';
  const paymentAmounts = getPaymentDisplayAmounts({ amountPaid, tipAmount, pawbucksUsed, paymentMethod, invoiceTotal, platformFee });
  const { pawbucksValueUSD, cashPortion, grossReceived, calculatedFee, netDeposited } = paymentAmounts;
  const isFullyPaid = amountDue <= 0;
  const payoutLabel = paymentMethod === 'pawbucks' ? 'PawBucks Credited' : 'Total Deposited';
  const payoutAmount = paymentMethod === 'pawbucks' ? grossReceived : netDeposited;
  const payoutNote = isManualPayment
    ? `Recorded as ${getPaymentMethodLabel(paymentMethod, pawbucksUsed, paymentMethodDetail)} payment.`
    : paymentMethod === 'pawbucks'
      ? `${pawbucksUsed.toLocaleString()} PawBucks were credited to your merchant wallet.`
      : pawbucksUsed > 0
        ? 'Cash deposit shown after Success Fee; PawBucks were credited separately.'
        : 'Funds have been sent to your connected Stripe account.';

  // Section helper
  const sectionLabel = (text: string) => `
    <td style="padding:0 32px 8px;">
      <p style="margin:0; font-size:11px; font-weight:700; letter-spacing:1.5px; color:#9ca3af; text-transform:uppercase;">${text}</p>
    </td>`;

  const divider = `<tr><td style="padding:0 32px;"><div style="border-top:1px solid #e5e7eb; margin:24px 0;"></div></td></tr>`;

  // Payment breakdown rows
  let breakdownRows = '';
  if (isManualPayment) {
    const label = getPaymentMethodLabel(paymentMethod, pawbucksUsed, paymentMethodDetail);
    breakdownRows = `
      <tr>
        <td style="font-size:14px;color:#374151;padding:6px 0;">${label} Payment</td>
        <td align="right" style="font-size:14px;color:#374151;padding:6px 0;">${formatCurrency(amountPaid)}</td>
      </tr>`;
  } else {
    breakdownRows = `
      <tr>
        <td style="font-size:14px;color:#374151;padding:6px 0;">Service Total</td>
        <td align="right" style="font-size:14px;color:#374151;padding:6px 0;">${formatCurrency(invoiceTotal)}</td>
      </tr>
      <tr>
        <td style="font-size:14px;color:#374151;padding:6px 0;">Customer Payment</td>
        <td align="right" style="font-size:14px;color:#374151;padding:6px 0;">${formatCurrency(cashPortion)}</td>
      </tr>`;

    if (pawbucksUsed > 0) {
      breakdownRows += `
        <tr>
          <td style="font-size:14px;color:#374151;padding:6px 0;">PawBucks Applied</td>
          <td align="right" style="font-size:14px;color:#16a34a;padding:6px 0;">${pawbucksUsed.toLocaleString()} PB (${formatCurrency(pawbucksValueUSD)})</td>
        </tr>`;
    }
    if (tipAmount > 0) {
      breakdownRows += `
        <tr>
          <td style="font-size:14px;color:#374151;padding:6px 0;">Tip Included</td>
          <td align="right" style="font-size:14px;color:#16a34a;padding:6px 0;">${formatCurrency(tipAmount)}</td>
        </tr>`;
    }
  }

  if (calculatedFee > 0 && !isManualPayment) {
    breakdownRows += `
      <tr>
        <td style="padding:10px 0 6px;">
          <span style="font-size:13px;color:#6b7280;">PawBucks Success Fee</span><br/>
          <span style="font-size:11px;color:#9ca3af;">(3% of cash portion)</span>
        </td>
        <td align="right" style="font-size:14px;color:#ef4444;padding:10px 0 6px;">-${formatCurrency(calculatedFee)}</td>
      </tr>`;
  }

  // Status
  const statusBadge = isFullyPaid
    ? `<span style="display:inline-block;background:#dcfce7;color:#166534;padding:4px 14px;border-radius:12px;font-size:12px;font-weight:600;">Approved ✔</span>`
    : `<span style="display:inline-block;background:#fef3c7;color:#92400e;padding:4px 14px;border-radius:12px;font-size:12px;font-weight:600;">Partial Payment</span>`;

  // Remaining balance card
  const remainingHtml = !isFullyPaid ? `
    ${divider}
    <tr>
      <td style="padding:0 32px;">
        <table width="100%" cellpadding="16" cellspacing="0" style="background:#fef3c7;border-radius:12px;">
          <tr><td>
            <p style="margin:0 0 4px;font-size:13px;color:#92400e;font-weight:600;">Remaining Balance</p>
            <p style="margin:0;font-size:24px;font-weight:800;color:#92400e;">${formatCurrency(amountDue)}</p>
          </td></tr>
        </table>
      </td>
    </tr>` : '';

  // Daily snapshot
  const snapshotHtml = snapshot ? `
    ${divider}
    <tr>${sectionLabel('Today on PawBucks')}</tr>
    <tr>
      <td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">
          <tr>
            <td width="33%" style="padding:12px 8px 12px 0;text-align:center;">
              <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:10px;">
                <tr><td style="text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:800;color:#166534;">${snapshot.transactions}</p>
                  <p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Transactions</p>
                </td></tr>
              </table>
            </td>
            <td width="33%" style="padding:12px 4px;text-align:center;">
              <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:10px;">
                <tr><td style="text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:800;color:#166534;">${formatCurrency(snapshot.revenue)}</p>
                  <p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">Revenue</p>
                </td></tr>
              </table>
            </td>
            <td width="33%" style="padding:12px 0 12px 8px;text-align:center;">
              <table width="100%" cellpadding="12" cellspacing="0" style="background:#f0fdf4;border-radius:10px;">
                <tr><td style="text-align:center;">
                  <p style="margin:0;font-size:22px;font-weight:800;color:#166534;">${snapshot.pawbucksEarned.toLocaleString()}</p>
                  <p style="margin:4px 0 0;font-size:10px;color:#6b7280;text-transform:uppercase;letter-spacing:0.5px;">PB Earned</p>
                </td></tr>
              </table>
            </td>
          </tr>
        </table>
      </td>
    </tr>` : '';

  // Merchant insight (reward earned by customer)
  const insightHtml = pawbucksEarned > 0 ? `
    ${divider}
    <tr>${sectionLabel('Merchant Insight')}</tr>
    <tr>
      <td style="padding:0 32px;">
        <table width="100%" cellpadding="16" cellspacing="0" style="background:linear-gradient(135deg,#fef9c3 0%,#fde68a 100%);border-radius:12px;">
          <tr><td style="text-align:center;">
            <p style="margin:0 0 4px;font-size:13px;color:#78350f;">This customer earned PawBucks from this purchase.</p>
            <p style="margin:8px 0 0;font-size:11px;color:#92400e;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Reward Earned</p>
            <p style="margin:4px 0 0;font-size:28px;font-weight:800;color:#78350f;">+${pawbucksEarned.toLocaleString()} PawBucks</p>
          </td></tr>
        </table>
      </td>
    </tr>` : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Payment Received</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f2f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f2f5;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;">

          <!-- ===== HEADER ===== -->
          <tr>
            <td style="background:#ffffff;padding:40px 32px 32px;text-align:center;border-radius:16px 16px 0 0;">
              <img src="https://yxpnkipcoxksmnsvpvwi.supabase.co/storage/v1/object/public/email-assets/pawbucks-logo-email.png" alt="PawBucks" width="120" height="120" style="display:block;margin:0 auto;width:120px;height:120px;">
              <p style="margin:16px 0 0;font-size:20px;font-weight:700;color:#1f2937;">Payment Received</p>
              <p style="margin:8px 0 0;font-size:14px;color:#6b7280;">A customer just completed a purchase.</p>
            </td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td style="background:#ffffff;padding:0;border-radius:0 0 16px 16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
              <table width="100%" cellpadding="0" cellspacing="0">

                <!-- Transaction Summary -->
                <tr><td style="height:28px;"></td></tr>
                <tr>${sectionLabel('Transaction Summary')}</tr>
                <tr>
                  <td style="padding:8px 32px 0;">
                    <table width="100%" cellpadding="14" cellspacing="0" style="background:#f8fafc;border-radius:12px;border:1px solid #e2e8f0;">
                      <tr><td>
                        <table width="100%" cellpadding="0" cellspacing="0">
                          <tr>
                            <td style="padding:4px 0;">
                              <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Merchant</span><br/>
                              <span style="font-size:15px;font-weight:700;color:#111827;">${displayName}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:10px 0 4px;">
                              <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Customer</span><br/>
                              <span style="font-size:15px;font-weight:600;color:#111827;">${clientName}</span>
                            </td>
                          </tr>
                          <tr>
                            <td style="padding:10px 0 4px;">
                              <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Date</span><br/>
                              <span style="font-size:14px;color:#374151;">${formattedDate}</span>
                            </td>
                          </tr>
                          ${invoiceTitle ? `<tr>
                            <td style="padding:10px 0 4px;">
                              <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Service</span><br/>
                              <span style="font-size:14px;color:#374151;">${invoiceTitle}</span>
                            </td>
                          </tr>` : ''}
                          <tr>
                            <td style="padding:10px 0 0;">
                              <span style="font-size:11px;color:#9ca3af;text-transform:uppercase;">Receipt ID</span><br/>
                              <span style="font-size:14px;font-weight:600;color:#374151;font-family:monospace;">${invoiceNumber}</span>
                            </td>
                          </tr>
                        </table>
                      </td></tr>
                    </table>
                  </td>
                </tr>

                ${divider}

                <!-- Payment Breakdown -->
                <tr>${sectionLabel('Payment Breakdown')}</tr>
                <tr>
                  <td style="padding:8px 32px 0;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      ${breakdownRows}
                    </table>
                  </td>
                </tr>

                ${divider}

                <!-- Total Deposited -->
                <tr>
                  <td style="padding:0 32px;">
                    <table width="100%" cellpadding="20" cellspacing="0" style="background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%);border-radius:12px;border:1px solid #bbf7d0;">
                      <tr><td style="text-align:center;">
                        <p style="margin:0 0 4px;font-size:11px;font-weight:700;letter-spacing:1.5px;color:#166534;text-transform:uppercase;">${payoutLabel}</p>
                        <p style="margin:0;font-size:36px;font-weight:800;color:#16a34a;">${formatCurrency(isManualPayment ? amountPaid : payoutAmount)}</p>
                        <p style="margin:8px 0 0;font-size:13px;color:#4ade80;">
                          ${payoutNote}
                        </p>
                        <div style="margin-top:10px;">${statusBadge}</div>
                      </td></tr>
                    </table>
                  </td>
                </tr>

                ${remainingHtml}

                ${divider}

                <!-- Customer Info -->
                <tr>${sectionLabel('Customer Info')}</tr>
                <tr>
                  <td style="padding:4px 32px 0;">
                    <p style="margin:0;font-size:15px;font-weight:600;color:#111827;">${clientName}</p>
                    <p style="margin:4px 0 0;font-size:14px;color:#6b7280;">${clientEmail}</p>
                  </td>
                </tr>

                ${insightHtml}

                ${snapshotHtml}

                ${divider}

                <!-- CTA -->
                <tr>
                  <td style="padding:0 32px;text-align:center;">
                    <p style="margin:0 0 6px;font-size:14px;color:#6b7280;">View transaction details and performance metrics.</p>
                    <a href="https://pawbucks.app/merchant/workspace${params.merchantId ? `?merchantId=${params.merchantId}` : ''}" style="display:inline-block;margin-top:12px;background:linear-gradient(135deg,#7DD4D4 0%,#5bb8b8 100%);color:#0f172a;text-decoration:none;padding:14px 36px;border-radius:10px;font-weight:700;font-size:15px;letter-spacing:0.3px;">
                      Open Merchant Workspace
                    </a>
                  </td>
                </tr>

                <tr><td style="height:32px;"></td></tr>

                <!-- Footer -->
                <tr>
                  <td style="padding:24px 32px;background:#f8fafc;text-align:center;border-radius:0 0 16px 16px;border-top:1px solid #e5e7eb;">
                    <p style="margin:0 0 8px;font-size:13px;color:#6b7280;">
                      Need help? <a href="mailto:support@pawbucks.app" style="color:#7DD4D4;text-decoration:none;font-weight:600;">support@pawbucks.app</a>
                    </p>
                    <p style="margin:12px 0 0;font-size:11px;color:#9ca3af;">
                      PawBucks, Inc. &bull; &copy; ${new Date().getFullYear()} PawBucks. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.log("[INVOICE_PAID_NOTIFICATION] RESEND_API_KEY not configured, skipping");
      return new Response(
        JSON.stringify({ success: false, message: "Email service not configured" }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    const resend = new Resend(resendApiKey);
    const params: InvoicePaidNotificationParams = await req.json();

    console.log('[INVOICE_PAID_NOTIFICATION] Sending to:', params.merchantEmail, 'Invoice:', params.invoiceNumber);

    // Fetch daily snapshot if merchantId available
    let snapshot: DailySnapshot | null = null;
    if (params.merchantId) {
      snapshot = await getMerchantDailySnapshot(params.merchantId);
    }

    const html = generateInvoicePaidEmailHtml(params, snapshot);
    const paymentAmounts = getPaymentDisplayAmounts(params);
    const subjectAmount = params.paymentMethod === 'pawbucks'
      ? paymentAmounts.grossReceived
      : paymentAmounts.netDeposited;

    const { data, error } = await resend.emails.send({
      from: "PawBucks <noreply@pawbucks.app>",
      to: [params.merchantEmail],
      subject: `💰 Payment Received - ${params.invoiceNumber} - ${formatCurrency(subjectAmount)}`,
      html,
    });

    if (error) {
      console.error('[INVOICE_PAID_NOTIFICATION] Send failed:', error);
      return new Response(
        JSON.stringify({ success: false, error: error.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
      );
    }

    console.log('[INVOICE_PAID_NOTIFICATION] ✅ Sent successfully:', data);
    return new Response(
      JSON.stringify({ success: true, emailId: data?.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[INVOICE_PAID_NOTIFICATION] Error:', errorMessage);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
